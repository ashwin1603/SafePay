"""
Cashfree Sandbox Payment Router
-------------------------------
Provides two endpoints:
  POST /cashfree/create-order  — create a Cashfree order and return the payment_session_id
  POST /cashfree/verify-order  — verify a completed order and record in SafePay DB
"""

import logging
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import client_ip, get_db, require_permission
from app.core import permissions as perms
from app.models.transaction import Transaction
from app.services.audit_service import record
from app.services.fraud_service import assess_fraud, write_fraud_log

logger = logging.getLogger("safepay.cashfree")

router = APIRouter(prefix="/cashfree", tags=["Cashfree"])

# ── Cashfree Sandbox constants ─────────────────────────────────────────────────
CASHFREE_SANDBOX_BASE = "https://sandbox.cashfree.com/pg"
CASHFREE_API_VERSION = "2023-08-01"


def _cf_headers() -> dict:
    return {
        "x-client-id": settings.CASHFREE_APP_ID,
        "x-client-secret": settings.CASHFREE_SECRET_KEY,
        "x-api-version": CASHFREE_API_VERSION,
        "Content-Type": "application/json",
    }


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    amount: float
    description: str = ""
    customer_name: str = "SafePay User"
    customer_email: str = ""
    customer_phone: str = "9999999999"
    return_url: str = "http://localhost:5173/process?cashfree=return"


class CreateOrderResponse(BaseModel):
    order_id: str
    payment_session_id: str
    order_status: str
    amount: float


class VerifyOrderRequest(BaseModel):
    order_id: str
    idempotency_key: Optional[str] = None


class VerifyOrderResponse(BaseModel):
    order_id: str
    order_status: str       # PAID | ACTIVE | EXPIRED | TERMINATION
    txn_id: Optional[str] = None
    risk_score: Optional[float] = None
    safepay_status: Optional[str] = None
    message: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/create-order", response_model=CreateOrderResponse)
async def create_cashfree_order(
    payload: CreateOrderRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(perms.PAYMENT_CREATE)),
):
    """
    Create a Cashfree order on the sandbox and return the payment_session_id.
    The frontend uses this session ID to launch the Cashfree checkout UI.
    """
    logger.info("DEBUG - CASHFREE_APP_ID loaded by server: %s", settings.CASHFREE_APP_ID)
    logger.info("DEBUG - CASHFREE_SECRET_KEY loaded by server: %s...", settings.CASHFREE_SECRET_KEY[:10] if settings.CASHFREE_SECRET_KEY else None)
    if payload.amount <= 0 or payload.amount > 1_000_000:
        raise HTTPException(status_code=422, detail="Invalid amount")

    # Use the user's email as the customer email if not provided
    customer_email = payload.customer_email or getattr(principal, "email", "test@example.com")

    order_id = f"safepay_{uuid.uuid4().hex[:16]}"

    cf_payload = {
        "order_id": order_id,
        "order_amount": round(payload.amount, 2),
        "order_currency": "INR",
        "order_note": payload.description or "SafePay payment",
        "customer_details": {
            "customer_id": f"cust_{getattr(principal, 'id', 'guest')}",
            "customer_name": payload.customer_name,
            "customer_email": customer_email,
            "customer_phone": payload.customer_phone,
        },
        "order_meta": {
            "return_url": f"{payload.return_url}&order_id={order_id}",
            "notify_url": "",  # Webhook URL — configure in Cashfree dashboard for sandbox
        },
    }

    try:
        logger.info("DEBUG - Headers being sent to Cashfree: %s", _cf_headers())
        logger.info("DEBUG - Payload being sent to Cashfree: %s", cf_payload)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{CASHFREE_SANDBOX_BASE}/orders",
                json=cf_payload,
                headers=_cf_headers(),
            )

        if resp.status_code not in (200, 201):
            body = resp.text
            logger.error("Cashfree create-order failed %s: %s", resp.status_code, body)
            raise HTTPException(
                status_code=502,
                detail=f"Cashfree order creation failed: {body}",
            )

        data = resp.json()
        session_id = data.get("payment_session_id") or data.get("cf_payment_session_id", "")
        if not session_id:
            raise HTTPException(status_code=502, detail="No payment_session_id in Cashfree response")

        logger.info("Cashfree order created: %s session: %s***", order_id, session_id[:12])

        record(
            db,
            actor=getattr(principal, "email", "unknown"),
            action="cashfree_order_created",
            target=order_id,
            ip=client_ip(request),
            detail=f"amount={payload.amount}",
        )

        return CreateOrderResponse(
            order_id=order_id,
            payment_session_id=session_id,
            order_status=data.get("order_status", "ACTIVE"),
            amount=payload.amount,
        )

    except httpx.RequestError as exc:
        logger.error("Network error calling Cashfree: %s", exc)
        raise HTTPException(status_code=503, detail="Could not reach Cashfree sandbox. Check your network.")


@router.post("/verify-order", response_model=VerifyOrderResponse)
async def verify_cashfree_order(
    payload: VerifyOrderRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(perms.PAYMENT_CREATE)),
):
    """
    Verify a Cashfree order after payment redirect.
    If PAID, run through SafePay fraud scoring and record the transaction.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{CASHFREE_SANDBOX_BASE}/orders/{payload.order_id}",
                headers=_cf_headers(),
            )

        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail="Cashfree order not found")
        if not resp.is_success:
            raise HTTPException(status_code=502, detail=f"Cashfree verification failed: {resp.text}")

        data = resp.json()
        order_status = data.get("order_status", "UNKNOWN")
        order_amount = float(data.get("order_amount", 0))

        if order_status != "PAID":
            return VerifyOrderResponse(
                order_id=payload.order_id,
                order_status=order_status,
                message=f"Order is {order_status} — no charge recorded.",
            )

        # ── Order is PAID → run fraud scoring and store in SafePay DB ──────────
        user_id = getattr(principal, "id", 0)
        idem_key = payload.idempotency_key or payload.order_id

        # Idempotency guard: don't double-record
        existing = (
            db.query(Transaction)
            .filter(Transaction.idempotency_key == idem_key)
            .first()
        )
        if existing:
            return VerifyOrderResponse(
                order_id=payload.order_id,
                order_status=order_status,
                txn_id=f"TXN-{existing.id:05d}",
                risk_score=existing.risk_score,
                safepay_status=existing.status,
                message="Duplicate — returning existing record.",
            )

        fraud_result = assess_fraud(amount=order_amount, user_id=user_id, db=db)

        txn = Transaction(
            user_id=user_id,
            amount=order_amount,
            description=data.get("order_note", "Cashfree payment"),
            status=fraud_result.decision,
            risk_score=fraud_result.risk_score,
            idempotency_key=idem_key,
            provider_ref=payload.order_id,
        )
        db.add(txn)
        db.flush()

        write_fraud_log(txn_id=txn.id, result=fraud_result, db=db)
        record(
            db,
            actor=getattr(principal, "email", "unknown"),
            action="cashfree_payment_verified",
            target=f"TXN-{txn.id:05d}",
            ip=client_ip(request),
            outcome=fraud_result.decision.lower(),
            detail=f"order={payload.order_id} amount={order_amount} risk={fraud_result.risk_score}",
            commit=False,
        )
        db.commit()
        db.refresh(txn)

        msg_map = {
            "COMPLETED": "Payment verified and recorded successfully.",
            "FLAGGED": "Payment flagged for manual review.",
            "BLOCKED": "Payment recorded but blocked by AI fraud detection.",
        }

        return VerifyOrderResponse(
            order_id=payload.order_id,
            order_status=order_status,
            txn_id=f"TXN-{txn.id:05d}",
            risk_score=fraud_result.risk_score,
            safepay_status=fraud_result.decision,
            message=msg_map.get(fraud_result.decision, "Payment processed."),
        )

    except httpx.RequestError as exc:
        logger.error("Network error verifying Cashfree order: %s", exc)
        raise HTTPException(status_code=503, detail="Could not reach Cashfree sandbox.")
