"""
Fraud Detection Service
-----------------------
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
"""

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Tuple

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


@dataclass
class FraudResult:
    risk_score: float
    decision: str
    reason: str


def assess_fraud(amount: float, user_id: int, db: Session) -> FraudResult:
    """Run IsolationForest and return a FraudResult."""
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
    else:
        zscore = 0.0

    features = np.array([_featurize(amount, user_id, txn_count_1h, zscore)])
    model = _get_model()

    # IsolationForest: -1 anomaly, +1 normal; score_samples returns raw scores
    raw_score = model.score_samples(features)[0]  # more negative = more anomalous

    # Normalise to [0, 1]: typical range is [-0.2, 0.2]
    # We invert so that higher score = more suspicious
    risk_score = float(np.clip(1.0 - (raw_score + 0.3) / 0.6, 0.0, 1.0))

    # Override: velocity spike always raises score
    if txn_count_1h >= 10:
        risk_score = max(risk_score, 0.85)
    elif txn_count_1h >= 5:
        risk_score = max(risk_score, 0.6)

    # Override: extreme z-score
    if zscore > 5:
        risk_score = max(risk_score, 0.75)

    risk_score = round(risk_score, 4)

    if risk_score > settings.FRAUD_BLOCK_THRESHOLD:
        decision = "BLOCKED"
        reason = _build_reason(risk_score, txn_count_1h, zscore, amount, blocked=True)
    elif risk_score > settings.FRAUD_FLAG_THRESHOLD:
        decision = "FLAGGED"
        reason = _build_reason(risk_score, txn_count_1h, zscore, amount, blocked=False)
    else:
        decision = "COMPLETED"
        reason = "Transaction appears normal"

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
