"""
Fraud Detection Service — Explainable Glass-Box Scoring
--------------------------------------------------------
Uses scikit-learn's IsolationForest trained on mock and live transaction data.

Features per transaction:
  [0] amount           – raw transaction amount
  [1] log_amount       – log1p(amount) to reduce scale effect
  [2] hour_of_day      – 0-23 (pattern: late-night = riskier)
  [3] txn_count_1h     – number of transactions by this user in the last hour
  [4] amount_zscore    – z-score vs user's historical mean spend

Risk score is 0.0 (safe) → 1.0 (anomalous).
Decision:
  > 0.8  → BLOCKED
  0.5–0.8 → FLAGGED
  < 0.5  → COMPLETED

EXPLAINABILITY: For every scoring, we return a structured FraudExplanation with
per-signal contributions and a plain-language summary.
"""

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
from sklearn.ensemble import IsolationForest
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

# ── Model singleton ──────────────────────────────────────────────────────────

_model: IsolationForest | None = None
_CONTAMINATION = 0.08   # ~8 % of training data considered anomalous


def _get_model() -> IsolationForest:
    global _model
    if _model is None:
        _model = _build_model_from_mock()
    return _model


def _build_model_from_mock() -> IsolationForest:
    """Train IsolationForest on synthetic data representing normal + fraud patterns."""
    rng = np.random.default_rng(42)
    N_NORMAL, N_FRAUD = 900, 100

    # --- Normal transactions ---
    normal_amounts   = rng.lognormal(mean=5.5, sigma=1.2, size=N_NORMAL)
    normal_hours     = rng.integers(8, 22, size=N_NORMAL)
    normal_counts    = rng.integers(1, 5, size=N_NORMAL)
    normal_zscores   = rng.normal(0, 0.8, size=N_NORMAL)

    # --- Fraudulent patterns ---
    fraud_amounts_hi = rng.uniform(8000, 50000, size=N_FRAUD // 2)
    fraud_amounts_lo = rng.uniform(0.01, 2, size=N_FRAUD // 2)
    fraud_amounts    = np.concatenate([fraud_amounts_hi, fraud_amounts_lo])  # exactly 100
    fraud_hours      = rng.integers(0, 6, size=N_FRAUD)
    fraud_counts     = rng.integers(10, 50, size=N_FRAUD)
    fraud_zscores    = rng.uniform(3, 8, size=N_FRAUD)

    all_amounts  = np.concatenate([normal_amounts, fraud_amounts])   # 1000
    all_hours    = np.concatenate([normal_hours,   fraud_hours])     # 1000
    all_counts   = np.concatenate([normal_counts,  fraud_counts])    # 1000
    all_zscores  = np.concatenate([normal_zscores, fraud_zscores])   # 1000

    X = np.column_stack([
        all_amounts,
        np.log1p(all_amounts),
        all_hours,
        all_counts,
        all_zscores,
    ])

    model = IsolationForest(
        n_estimators=200,
        contamination=_CONTAMINATION,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    logger.info("IsolationForest trained on %d samples", len(X))
    return model


def retrain_from_db(db: Session) -> str:
    """Retrain model using live transactions stored in the DB."""
    global _model
    now = datetime.now(timezone.utc)
    rows = (
        db.query(Transaction)
        .filter(Transaction.status != "PROCESSING")
        .all()
    )
    if len(rows) < 20:
        return "Not enough data — need at least 20 completed transactions"

    X = np.array([_featurize(t.amount, t.user_id, 0, 0.0) for t in rows])
    model = IsolationForest(n_estimators=200, contamination=_CONTAMINATION, random_state=42, n_jobs=-1)
    model.fit(X)
    _model = model
    return f"Model retrained on {len(rows)} live transactions"


# ── Featurizer ───────────────────────────────────────────────────────────────

def _featurize(
    amount: float,
    user_id: int,
    txn_count_1h: int,
    amount_zscore: float,
) -> list:
    hour = datetime.now(timezone.utc).hour
    return [
        amount,
        math.log1p(amount),
        hour,
        txn_count_1h,
        amount_zscore,
    ]


def _get_user_behavior(user_id: int, db: Session) -> Tuple[int, float]:
    """Return (txn_count_last_hour, amount_zscore_vs_history)."""
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id, Transaction.created_at >= since)
        .count()
    )

    all_amounts = (
        db.query(Transaction.amount)
        .filter(Transaction.user_id == user_id, Transaction.status == "COMPLETED")
        .all()
    )
    if len(all_amounts) >= 2:
        vals = [r[0] for r in all_amounts]
        mean, std = float(np.mean(vals)), float(np.std(vals))
        return recent, 0.0 if std == 0 else 0.0  # zscore computed at call site
    return recent, 0.0


# ── Signal contribution (explainability) ─────────────────────────────────────

@dataclass
class SignalContribution:
    """One signal's contribution to the fraud decision."""
    signal_name: str
    raw_value: float
    weight: float
    impact: str      # "high", "medium", "low"
    description: str


@dataclass
class FraudExplanation:
    """Structured explanation for a fraud decision."""
    decision: str
    risk_score: float
    summary: str
    signals: List[SignalContribution]

    def to_dict(self) -> dict:
        return {
            "decision": self.decision,
            "risk_score": self.risk_score,
            "summary": self.summary,
            "signals": [
                {
                    "signal_name": s.signal_name,
                    "raw_value": s.raw_value,
                    "weight": round(s.weight, 4),
                    "impact": s.impact,
                    "description": s.description,
                }
                for s in self.signals
            ],
        }


def _impact_level(weight: float) -> str:
    if weight >= 0.3:
        return "high"
    if weight >= 0.1:
        return "medium"
    return "low"


def _build_explanation(
    risk_score: float,
    decision: str,
    amount: float,
    txn_count_1h: int,
    zscore: float,
    hour: int,
    user_mean: float,
    base_ml_score: float,
) -> FraudExplanation:
    """Build a structured, explainable fraud explanation with per-signal contributions."""
    signals: List[SignalContribution] = []

    # Signal 1: Amount vs user mean
    if user_mean > 0:
        ratio = amount / user_mean
        weight = min(abs(ratio - 1.0) * 0.1, 0.4)
        signals.append(SignalContribution(
            signal_name="amount_vs_user_mean",
            raw_value=round(ratio, 2),
            weight=weight,
            impact=_impact_level(weight),
            description=f"Amount ${amount:,.2f} is {ratio:.1f}x your average (${user_mean:,.2f})"
            if ratio > 1.5 else f"Amount ${amount:,.2f} is within normal range for your account",
        ))
    else:
        signals.append(SignalContribution(
            signal_name="amount_vs_user_mean",
            raw_value=amount,
            weight=0.05,
            impact="low",
            description=f"First transaction — no spending history for comparison",
        ))

    # Signal 2: Velocity (transactions per hour)
    vel_weight = 0.0
    if txn_count_1h >= 10:
        vel_weight = 0.4
    elif txn_count_1h >= 5:
        vel_weight = 0.25
    elif txn_count_1h >= 3:
        vel_weight = 0.1
    signals.append(SignalContribution(
        signal_name="velocity_1h",
        raw_value=float(txn_count_1h),
        weight=vel_weight,
        impact=_impact_level(vel_weight),
        description=f"{txn_count_1h} transactions in the last hour"
        + (" — unusually high velocity" if txn_count_1h >= 5 else ""),
    ))

    # Signal 3: Amount z-score
    z_weight = 0.0
    if zscore > 5:
        z_weight = 0.35
    elif zscore > 3:
        z_weight = 0.2
    elif zscore > 2:
        z_weight = 0.1
    signals.append(SignalContribution(
        signal_name="amount_zscore",
        raw_value=round(zscore, 2),
        weight=z_weight,
        impact=_impact_level(z_weight),
        description=f"Amount deviates {zscore:.1f}σ from your historical mean"
        if zscore > 1 else "Amount is within normal statistical range",
    ))

    # Signal 4: Time of day
    is_odd_hour = hour < 6 or hour > 22
    tod_weight = 0.15 if is_odd_hour else 0.0
    signals.append(SignalContribution(
        signal_name="time_of_day",
        raw_value=float(hour),
        weight=tod_weight,
        impact=_impact_level(tod_weight),
        description=f"Transaction at {hour:02d}:00 UTC"
        + (" — unusual hour (late night/early morning)" if is_odd_hour else " — normal business hours"),
    ))

    # Signal 5: ML model anomaly score
    ml_weight = min(max(base_ml_score * 0.3, 0), 0.3)
    signals.append(SignalContribution(
        signal_name="ml_anomaly_score",
        raw_value=round(base_ml_score, 4),
        weight=ml_weight,
        impact=_impact_level(ml_weight),
        description=f"IsolationForest anomaly score: {base_ml_score:.3f}",
    ))

    # Signal 6: Absolute amount
    amt_weight = 0.0
    if amount > 9000:
        amt_weight = 0.25
    elif amount > 5000:
        amt_weight = 0.1
    signals.append(SignalContribution(
        signal_name="absolute_amount",
        raw_value=amount,
        weight=amt_weight,
        impact=_impact_level(amt_weight),
        description=f"Transaction amount: ${amount:,.2f}"
        + (" — large transaction" if amount > 5000 else ""),
    ))

    # Sort by weight descending
    signals.sort(key=lambda s: s.weight, reverse=True)

    # Build plain-language summary
    summary = _build_summary(decision, risk_score, signals, amount, txn_count_1h, zscore, user_mean)

    return FraudExplanation(
        decision=decision,
        risk_score=risk_score,
        summary=summary,
        signals=signals,
    )


def _build_summary(
    decision: str, score: float, signals: List[SignalContribution],
    amount: float, count: int, zscore: float, user_mean: float,
) -> str:
    """Build a human-readable summary sentence."""
    if decision == "COMPLETED":
        return "Transaction appears normal — no significant risk signals detected."

    top_reasons = [s for s in signals if s.impact in ("high", "medium")]
    if not top_reasons:
        top_reasons = signals[:2]

    reason_parts = []
    for s in top_reasons[:3]:
        if s.signal_name == "velocity_1h" and s.raw_value >= 5:
            reason_parts.append(f"high transaction velocity ({int(s.raw_value)} in the last hour)")
        elif s.signal_name == "amount_vs_user_mean" and s.raw_value > 2:
            reason_parts.append(f"the amount (${amount:,.2f}) is {s.raw_value:.1f}x your average")
        elif s.signal_name == "amount_zscore" and zscore > 2:
            reason_parts.append(f"the amount deviates {zscore:.1f}σ from your history")
        elif s.signal_name == "absolute_amount" and amount > 5000:
            reason_parts.append(f"large transaction amount (${amount:,.2f})")
        elif s.signal_name == "time_of_day" and s.weight > 0:
            reason_parts.append("unusual time of day")

    if not reason_parts:
        reason_parts.append("elevated anomaly score from multiple signals")

    prefix = "BLOCKED" if decision == "BLOCKED" else "Flagged for review"
    return f"{prefix} (risk score {score:.2f}): {', '.join(reason_parts)}."


# ── FraudResult ──────────────────────────────────────────────────────────────

@dataclass
class FraudResult:
    risk_score: float
    decision: str
    reason: str
    explanation: Optional[FraudExplanation] = None


def assess_fraud(amount: float, user_id: int, db: Session) -> FraudResult:
    """Run IsolationForest and return a FraudResult with full explanation."""
    txn_count_1h, _ = _get_user_behavior(user_id, db)

    # Compute amount z-score vs user history
    all_amounts = [
        r[0]
        for r in db.query(Transaction.amount)
        .filter(Transaction.user_id == user_id, Transaction.status == "COMPLETED")
        .all()
    ]
    if len(all_amounts) >= 2:
        mean, std = float(np.mean(all_amounts)), float(np.std(all_amounts))
        zscore = abs(amount - mean) / (std + 1e-9)
        user_mean = mean
    else:
        zscore = 0.0
        user_mean = float(np.mean(all_amounts)) if all_amounts else 0.0

    hour = datetime.now(timezone.utc).hour
    features = np.array([_featurize(amount, user_id, txn_count_1h, zscore)])
    model = _get_model()

    # IsolationForest: -1 anomaly, +1 normal; score_samples returns raw scores
    raw_score = model.score_samples(features)[0]  # more negative = more anomalous

    # Normalise to [0, 1]: typical range is [-0.2, 0.2]
    # We invert so that higher score = more suspicious
    risk_score = float(np.clip(1.0 - (raw_score + 0.3) / 0.6, 0.0, 1.0))
    base_ml_score = risk_score  # Save raw ML score for explanation

    # Override: velocity spike always raises score
    if txn_count_1h >= 10:
        risk_score = max(risk_score, 0.85)
    elif txn_count_1h >= 5:
        risk_score = max(risk_score, 0.6)

    # Override: extreme z-score
    if zscore > 5:
        risk_score = max(risk_score, 0.75)

    risk_score = round(risk_score, 4)

    # A BLOCK must be corroborated by a concrete signal — never by time-of-day
    # alone — so legitimate low-amount, low-velocity payments are not blocked.
    hard_signal = (amount > 9_000) or (txn_count_1h >= 10) or (zscore > 5)
    if risk_score > settings.FRAUD_BLOCK_THRESHOLD and not hard_signal:
        risk_score = min(risk_score, 0.79)  # cap at FLAGGED tier

    if risk_score > settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCKED"
        reason = _build_reason(risk_score, txn_count_1h, zscore, amount, blocked=True)
    elif risk_score > settings.FRAUD_FLAG_THRESHOLD:
        decision = "FLAGGED"
        reason = _build_reason(risk_score, txn_count_1h, zscore, amount, blocked=False)
    else:
        decision = "COMPLETED"
        reason = "Transaction appears normal"

    # Build structured explanation
    explanation = _build_explanation(
        risk_score=risk_score,
        decision=decision,
        amount=amount,
        txn_count_1h=txn_count_1h,
        zscore=zscore,
        hour=hour,
        user_mean=user_mean,
        base_ml_score=base_ml_score,
    )

    return FraudResult(
        risk_score=risk_score, decision=decision, reason=reason,
        explanation=explanation,
    )


def assess_fraud_simulated(
    amount: float,
    hour_of_day: int = 12,
    txn_count_1h: int = 0,
    amount_zscore: float = 0.0,
) -> FraudResult:
    """Score a synthetic transaction (for simulation sandbox — no DB required)."""
    features = np.array([[
        amount,
        math.log1p(amount),
        hour_of_day,
        txn_count_1h,
        amount_zscore,
    ]])
    model = _get_model()
    raw_score = model.score_samples(features)[0]
    risk_score = float(np.clip(1.0 - (raw_score + 0.3) / 0.6, 0.0, 1.0))

    if txn_count_1h >= 10:
        risk_score = max(risk_score, 0.85)
    elif txn_count_1h >= 5:
        risk_score = max(risk_score, 0.6)
    if amount_zscore > 5:
        risk_score = max(risk_score, 0.75)
    risk_score = round(risk_score, 4)

    hard_signal = (amount > 9_000) or (txn_count_1h >= 10) or (amount_zscore > 5)
    if risk_score > settings.FRAUD_BLOCK_THRESHOLD and not hard_signal:
        risk_score = min(risk_score, 0.79)

    if risk_score > settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCKED"
    elif risk_score > settings.FRAUD_FLAG_THRESHOLD:
        decision = "FLAGGED"
    else:
        decision = "COMPLETED"

    reason = _build_reason(risk_score, txn_count_1h, amount_zscore, amount,
                           blocked=(decision == "BLOCKED"))
    return FraudResult(risk_score=risk_score, decision=decision, reason=reason)


def _build_reason(score: float, count: int, zscore: float, amount: float, blocked: bool) -> str:
    parts = [f"Risk score {score:.2f}"]
    if count >= 5:
        parts.append(f"high velocity ({count} txns/hr)")
    if zscore > 3:
        parts.append(f"amount anomaly (z={zscore:.1f}σ)")
    if amount > 9_000:
        parts.append("large-amount transaction")
    prefix = "AUTO-BLOCKED" if blocked else "FLAGGED FOR REVIEW"
    return f"{prefix}: {', '.join(parts)}"


def write_fraud_log(
    txn_id: int,
    result: FraudResult,
    db: Session,
) -> None:
    log = FraudLog(
        txn_id=txn_id,
        risk_score=result.risk_score,
        decision=result.decision,
        reason=result.reason,
    )
    db.add(log)
    # Caller is responsible for commit
