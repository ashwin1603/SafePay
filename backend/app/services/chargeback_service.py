"""Chargeback / Dispute Prediction — proactive risk identification."""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta, timezone
from typing import List

import numpy as np
from sqlalchemy.orm import Session

from app.models.transaction import Transaction

logger = logging.getLogger(__name__)


def _compute_chargeback_risk(
    txn: Transaction, user_mean: float, user_txn_count: int
) -> float:
    """Heuristic chargeback probability based on transaction features.

    Factors considered:
    - Original fraud risk score
    - Deviation from user's average spend
    - Time-of-day (late-night / early-morning)
    - New-user penalty
    - Absolute amount thresholds
    """
    score = 0.0

    # High original risk score
    if txn.risk_score > 0.4:
        score += txn.risk_score * 0.4

    # Amount deviation from user average
    if user_mean > 0:
        amount_ratio = txn.amount / user_mean
        if amount_ratio > 3:
            score += min(amount_ratio * 0.05, 0.3)

    # Unusual hour
    hour = txn.created_at.hour if txn.created_at else 12
    if hour < 6 or hour > 22:
        score += 0.1

    # New user
    if user_txn_count <= 1:
        score += 0.15

    # Absolute amount thresholds
    if txn.amount > 5000:
        score += 0.1
    elif txn.amount > 1000:
        score += 0.05

    return round(min(score, 1.0), 4)


def _risk_level(probability: float) -> str:
    """Map a chargeback probability to a human-readable risk level."""
    if probability >= 0.7:
        return "critical"
    if probability >= 0.5:
        return "high"
    if probability >= 0.3:
        return "medium"
    return "low"


def predict_for_transaction(txn: Transaction, db: Session) -> dict:
    """Compute chargeback risk prediction for a single transaction.

    Queries the user's historical spend to derive deviation metrics
    and returns a detailed risk breakdown.
    """
    user_amounts = [
        r[0]
        for r in db.query(Transaction.amount)
        .filter(
            Transaction.user_id == txn.user_id,
            Transaction.status == "COMPLETED",
        )
        .all()
    ]
    user_mean = float(np.mean(user_amounts)) if user_amounts else 0.0
    user_count = len(user_amounts)

    prob = _compute_chargeback_risk(txn, user_mean, user_count)

    # Compute amount z-score relative to user history
    if len(user_amounts) >= 2:
        amount_zscore = round(
            abs(txn.amount - user_mean)
            / (float(np.std(user_amounts)) + 1e-9),
            2,
        )
    else:
        amount_zscore = 0.0

    return {
        "transaction_id": txn.id,
        "txn_id": f"TXN-{txn.id:05d}",
        "amount": txn.amount,
        "status": txn.status,
        "chargeback_probability": prob,
        "risk_level": _risk_level(prob),
        "risk_factors": {
            "risk_score_at_payment": txn.risk_score,
            "amount_zscore": amount_zscore,
            "velocity_factor": 0.0,
            "time_of_day_risk": 0.1
            if (
                txn.created_at
                and (txn.created_at.hour < 6 or txn.created_at.hour > 22)
            )
            else 0.0,
            "is_first_transaction": user_count <= 1,
            "amount_vs_user_mean": round(
                txn.amount / max(user_mean, 1), 2
            ),
        },
        "created_at": txn.created_at,
    }


def scan_recent(db: Session, threshold: float = 0.25) -> dict:
    """Scan recent completed transactions for chargeback risk.

    Returns transactions whose predicted chargeback probability
    exceeds *threshold*, sorted by risk descending (capped at 50).
    """
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.status == "COMPLETED",
            Transaction.created_at
            >= datetime.now(timezone.utc) - timedelta(days=30),
        )
        .order_by(Transaction.created_at.desc())
        .limit(200)
        .all()
    )

    predictions: List[dict] = []
    for txn in txns:
        pred = predict_for_transaction(txn, db)
        if pred["chargeback_probability"] >= threshold:
            predictions.append(pred)

    predictions.sort(
        key=lambda x: x["chargeback_probability"], reverse=True
    )

    high_risk = sum(
        1
        for p in predictions
        if p["risk_level"] in ("high", "critical")
    )
    return {
        "total_scanned": len(txns),
        "high_risk_count": high_risk,
        "predictions": predictions[:50],
    }
