"""
Payment Processing Service
--------------------------
Implements:
  1. Exactly-once delivery via idempotency_key
  2. Atomic DB transaction: PROCESSING → final status
  3. Fraud assessment via IsolationForest
  4. FraudLog write within same DB transaction
"""

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.fraud_service import assess_fraud, write_fraud_log

logger = logging.getLogger(__name__)


def process_payment(
    payload: ProcessPaymentRequest,
    db: Session,
) -> PaymentResponse:
    # ── Step 1: Idempotency check ─────────────────────────────────────────────
    existing = (
        db.query(Transaction)
        .filter(Transaction.idempotency_key == payload.idempotency_key)
        .first()
    )
    if existing:
        logger.info("Idempotent replay: key=%s txn=%d", payload.idempotency_key, existing.id)
        return PaymentResponse(
            txn_id=f"TXN-{existing.id:05d}",
            status=existing.status,
            risk_score=existing.risk_score,
            message="Duplicate request — returning existing transaction result",
            idempotency_key=existing.idempotency_key,
            is_duplicate=True,
        )

    # ── Step 2: Create txn in PROCESSING state ────────────────────────────────
    txn = Transaction(
        user_id=payload.user_id,
        amount=payload.amount,
        description=payload.description,
        status="PROCESSING",
        risk_score=0.0,
        idempotency_key=payload.idempotency_key,
    )
    db.add(txn)
    db.flush()   # get txn.id without committing

    try:
        # ── Step 3: Fraud assessment ──────────────────────────────────────────
        result = assess_fraud(
            amount=payload.amount,
            user_id=payload.user_id,
            db=db,
        )

        # ── Step 4: Apply state transition ────────────────────────────────────
        txn.status = result.decision
        txn.risk_score = result.risk_score

        # ── Step 5: Write fraud log (same transaction) ────────────────────────
        write_fraud_log(txn_id=txn.id, result=result, db=db)

        # ── Step 6: Atomic commit ─────────────────────────────────────────────
        db.commit()
        db.refresh(txn)

        logger.info(
            "Payment processed: txn=%d user=%d amount=%.2f status=%s score=%.4f",
            txn.id, payload.user_id, payload.amount, txn.status, txn.risk_score,
        )

        message_map = {
            "COMPLETED": "Payment processed successfully",
            "FLAGGED": "Payment flagged for manual review",
            "BLOCKED": "Payment blocked by AI fraud detection",
        }

        return PaymentResponse(
            txn_id=f"TXN-{txn.id:05d}",
            status=txn.status,
            risk_score=txn.risk_score,
            message=message_map.get(txn.status, "Unknown"),
            idempotency_key=txn.idempotency_key,
            is_duplicate=False,
        )

    except Exception as exc:
        db.rollback()
        logger.error("Payment processing failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment processing failed — please retry",
        ) from exc
