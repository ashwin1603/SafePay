"""Real-Time Fraud Analytics & Model Observability."""
from __future__ import annotations

import logging
import math
from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import List

import numpy as np
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)


def risk_distribution(db: Session) -> dict:
    """Return a 10-bucket histogram of risk scores for non-processing txns."""
    txns = (
        db.query(Transaction.risk_score)
        .filter(Transaction.status != "PROCESSING")
        .all()
    )
    scores = [t[0] for t in txns]
    if not scores:
        return {"buckets": [], "total": 0}

    buckets: List[dict] = []
    for i in range(10):
        lo, hi = i * 0.1, (i + 1) * 0.1
        label = f"{lo:.1f}-{hi:.1f}"
        count = (
            sum(1 for s in scores if lo <= s < hi)
            if i < 9
            else sum(1 for s in scores if lo <= s <= hi)
        )
        buckets.append(
            {
                "range_label": label,
                "count": count,
                "percentage": round(count / len(scores) * 100, 1),
            }
        )
    return {"buckets": buckets, "total": len(scores)}


def rates_over_time(db: Session, days: int = 7) -> list:
    """Return per-day completed / flagged / blocked counts for recent txns."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.created_at >= since,
            Transaction.status != "PROCESSING",
        )
        .all()
    )

    by_day: dict[str, dict] = {}
    for txn in txns:
        day = (
            txn.created_at.strftime("%Y-%m-%d")
            if txn.created_at
            else "unknown"
        )
        if day not in by_day:
            by_day[day] = {
                "completed": 0,
                "flagged": 0,
                "blocked": 0,
                "total": 0,
            }
        by_day[day]["total"] += 1
        status_key = txn.status.lower()
        if status_key in by_day[day]:
            by_day[day][status_key] += 1

    result: List[dict] = []
    for period in sorted(by_day.keys()):
        d = by_day[period]
        result.append({"period": period, **d})
    return result


def top_signals(db: Session) -> list:
    """Return the top-10 most frequent high/medium-impact fraud signals."""
    explanations = (
        db.query(Transaction.fraud_explanation)
        .filter(Transaction.fraud_explanation.isnot(None))
        .limit(500)
        .all()
    )
    signal_counts: Counter[str] = Counter()
    total = 0
    for (expl,) in explanations:
        if not expl:
            continue
        try:
            data = expl if isinstance(expl, dict) else {}
            for sig in data.get("signals", []):
                if sig.get("impact") in ("high", "medium"):
                    signal_counts[sig["signal_name"]] += 1
                    total += 1
        except (TypeError, KeyError):
            continue

    result: List[dict] = []
    for name, count in signal_counts.most_common(10):
        result.append(
            {
                "signal_name": name,
                "fire_count": count,
                "percentage": round(count / max(total, 1) * 100, 1),
            }
        )
    return result


def model_drift(db: Session) -> dict:
    """Detect model drift via KS test between recent and all-time scores.

    Falls back to a simple mean-difference heuristic when *scipy* is not
    installed.
    """
    recent = (
        db.query(Transaction.risk_score)
        .filter(
            Transaction.status != "PROCESSING",
            Transaction.created_at
            >= datetime.now(timezone.utc) - timedelta(days=7),
        )
        .all()
    )
    all_scores = (
        db.query(Transaction.risk_score)
        .filter(Transaction.status != "PROCESSING")
        .all()
    )

    recent_scores = [r[0] for r in recent]
    all_sc = [r[0] for r in all_scores]

    if len(recent_scores) < 5 or len(all_sc) < 10:
        return {
            "ks_statistic": 0.0,
            "p_value": 1.0,
            "is_drifting": False,
            "message": "Insufficient data for drift detection",
        }

    try:
        from scipy.stats import ks_2samp

        stat, pval = ks_2samp(recent_scores, all_sc)
    except ImportError:
        recent_mean = float(np.mean(recent_scores))
        all_mean = float(np.mean(all_sc))
        stat = abs(recent_mean - all_mean)
        pval = 1.0 if stat < 0.1 else 0.05

    is_drifting = pval < 0.05
    msg = (
        "Model drift detected — consider retraining"
        if is_drifting
        else "No significant drift detected"
    )
    return {
        "ks_statistic": round(float(stat), 4),
        "p_value": round(float(pval), 4),
        "is_drifting": is_drifting,
        "message": msg,
    }


def summary(db: Session) -> dict:
    """Return a comprehensive analytics dashboard payload."""
    total = (
        db.query(sqlfunc.count(Transaction.id))
        .filter(Transaction.status != "PROCESSING")
        .scalar()
        or 0
    )
    avg_risk = (
        db.query(sqlfunc.avg(Transaction.risk_score))
        .filter(Transaction.status != "PROCESSING")
        .scalar()
        or 0.0
    )
    blocked = (
        db.query(sqlfunc.count(Transaction.id))
        .filter(Transaction.status == "BLOCKED")
        .scalar()
        or 0
    )
    flagged = (
        db.query(sqlfunc.count(Transaction.id))
        .filter(Transaction.status == "FLAGGED")
        .scalar()
        or 0
    )

    return {
        "risk_distribution": risk_distribution(db),
        "rates": rates_over_time(db),
        "top_signals": top_signals(db),
        "drift": model_drift(db),
        "total_transactions": total,
        "avg_risk_score": round(float(avg_risk), 4),
        "block_rate": round(blocked / max(total, 1) * 100, 2),
        "flag_rate": round(flagged / max(total, 1) * 100, 2),
    }
