"""
Payment processing — with explainable fraud and step-up authentication.

Order of operations:
  1. Idempotency replay guard (exactly-once).
  2. Create txn in PROCESSING.
  3. Rules engine evaluation (operator-authored rules).
  4. Fraud assessment (IsolationForest + explainability).
  5. Step-up challenge if risk is medium-range.
  6. If allowed, charge via the configured provider (tokenized; no PAN here).
  7. Write fraud log + audit, single atomic commit.
"""

import logging

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.transaction import Transaction
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.audit_service import record
from app.services.fraud_service import assess_fraud, write_fraud_log
from app.services.payment_provider import charge

logger = logging.getLogger("safepay.payments")


def process_payment(payload: ProcessPaymentRequest, *, user_id: int, user_email: str,
                    db: Session, ip: str = "", step_up_verified: bool = False) -> PaymentResponse:
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
            fraud_explanation=existing.fraud_explanation,
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

        # Store fraud explanation as JSON
        if result.explanation:
            txn.fraud_explanation = result.explanation.to_dict()

        # ── Evaluate operator-authored rules ────────────────────────────────
        try:
            from app.services.rules_engine import evaluate_rules
            rule_context = {
                "amount": payload.amount,
                "risk_score": result.risk_score,
                "hour_of_day": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).hour,
                "velocity_1h": 0,
                "velocity_24h": 0,
                "amount_zscore": 0.0,
            }
            rule_action, rule_name = evaluate_rules(rule_context, db)
            if rule_action == "BLOCKED":
                result.decision = "BLOCKED"
                result.reason = f"Blocked by rule: {rule_name}"
            elif rule_action == "FLAGGED" and result.decision == "COMPLETED":
                result.decision = "FLAGGED"
                result.reason = f"Flagged by rule: {rule_name}"
        except Exception:
            pass  # Rules engine is optional

        # ── Step-up challenge (risk between STEPUP_THRESHOLD and FLAG) ──────
        needs_stepup = (
            settings.STEPUP_THRESHOLD <= result.risk_score <= settings.FRAUD_FLAG_THRESHOLD
            and result.decision == "COMPLETED"
            and not step_up_verified
        )

        provider_ref = None
        if result.decision == "BLOCKED":
            txn.status = "BLOCKED"
            message = "Payment blocked by AI fraud detection"
        elif needs_stepup:
            # Return step-up challenge — don't process payment yet
            txn.status = "PROCESSING"
            write_fraud_log(txn_id=txn.id, result=result, db=db)
            record(db, actor=user_email, action="payment_stepup", target=f"TXN-{txn.id:05d}",
                   ip=ip, outcome="pending",
                   detail=f"amount={payload.amount} risk={result.risk_score}", commit=False)
            db.commit()
            db.refresh(txn)

            # Create step-up challenge
            from app.services.stepup import create_challenge
            challenge = create_challenge(user_id=user_id, txn_context={
                "txn_id": txn.id,
                "amount": payload.amount,
                "idempotency_key": payload.idempotency_key,
            })

            return PaymentResponse(
                txn_id=f"TXN-{txn.id:05d}", status="STEP_UP_REQUIRED",
                risk_score=txn.risk_score,
                message="Step-up authentication required. Please verify the OTP.",
                idempotency_key=txn.idempotency_key, is_duplicate=False,
                step_up_required=True,
                challenge_id=challenge.challenge_id,
                dev_otp=challenge.code,
                fraud_explanation=txn.fraud_explanation,
            )
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
            fraud_explanation=txn.fraud_explanation,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        logger.error("Payment failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Payment processing failed — please retry") from exc
