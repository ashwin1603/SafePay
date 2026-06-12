"""
Payment processing.

Order of operations:
  1. Idempotency replay guard (exactly-once).
  2. Create txn in PROCESSING.
  3. Fraud assessment (IsolationForest). BLOCKED never reaches the processor.
  4. If allowed, charge via the configured provider (tokenized; no PAN here).
  5. Write fraud log + audit, single atomic commit.
"""

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.audit_service import record
from app.services.fraud_service import assess_fraud, write_fraud_log
from app.services.payment_provider import charge

logger = logging.getLogger("safepay.payments")


def process_payment(payload: ProcessPaymentRequest, *, user_id: int, user_email: str,
                    db: Session, ip: str = "") -> PaymentResponse:
    existing = (
        db.query(Transaction)
        .filter(Transaction.idempotency_key == payload.idempotency_key)
        .first()
    )
    if existing:
        # Only the original payer may replay their idempotency key.
        if existing.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="idempotency_key already used")
        return PaymentResponse(
            txn_id=f"TXN-{existing.id:05d}", status=existing.status,
            risk_score=existing.risk_score,
            message="Duplicate request — returning existing result",
            idempotency_key=existing.idempotency_key, is_duplicate=True,
        )

    txn = Transaction(
        user_id=user_id, amount=payload.amount, description=payload.description,
        status="PROCESSING", risk_score=0.0, idempotency_key=payload.idempotency_key,
    )
    db.add(txn)
    db.flush()

    try:
        result = assess_fraud(amount=payload.amount, user_id=user_id, db=db)
        txn.risk_score = result.risk_score

        provider_ref = None
        if result.decision == "BLOCKED":
            txn.status = "BLOCKED"
            message = "Payment blocked by AI fraud detection"
        else:
            charge_res = charge(payload.amount, payload.card_token)
            provider_ref = charge_res.provider_ref
            if not charge_res.ok:
                txn.status = "DECLINED"
                message = f"Payment declined: {charge_res.detail}"
            else:
                txn.status = result.decision  # COMPLETED or FLAGGED
                message = ("Payment flagged for manual review"
                           if txn.status == "FLAGGED" else "Payment processed successfully")

        if provider_ref:
            txn.provider_ref = provider_ref
        write_fraud_log(txn_id=txn.id, result=result, db=db)
        record(db, actor=user_email, action="payment", target=f"TXN-{txn.id:05d}",
               ip=ip, outcome=txn.status.lower(),
               detail=f"amount={payload.amount} risk={result.risk_score}", commit=False)
        db.commit()
        db.refresh(txn)

        return PaymentResponse(
            txn_id=f"TXN-{txn.id:05d}", status=txn.status, risk_score=txn.risk_score,
            message=message, idempotency_key=txn.idempotency_key,
            is_duplicate=False, provider_ref=provider_ref,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Payment failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Payment processing failed — please retry") from exc
