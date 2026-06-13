from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator


class ProcessPaymentRequest(BaseModel):
    """
    A payment request. The payer is ALWAYS the authenticated user — there is no
    user_id field, so a caller can never charge or impersonate another account.

    Raw card data never touches this server. The client tokenizes the card with
    the PCI-certified processor (Stripe.js) and sends only an opaque token.
    """
    amount: float
    description: str = ""
    idempotency_key: str
    card_token: Optional[str] = None  # e.g. "tok_visa" / "pm_..." (simulated mode ignores)

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        if v > 1_000_000:
            raise ValueError("Amount exceeds maximum single-transaction limit")
        return round(v, 2)

    @field_validator("idempotency_key")
    @classmethod
    def key_ok(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("idempotency_key cannot be empty")
        if len(v) > 128:
            raise ValueError("idempotency_key too long (max 128 chars)")
        return v

    @field_validator("description")
    @classmethod
    def desc_len(cls, v: str) -> str:
        if len(v) > 500:
            raise ValueError("description too long")
        return v


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    txn_id: str
    user_id: int
    amount: float
    description: str
    status: str
    risk_score: float
    created_at: datetime
    fraud_explanation: Optional[Dict[str, Any]] = None
    appeal_status: Optional[str] = None
    appeal_reason: Optional[str] = None
    appeal_reviewed_by: Optional[str] = None
    appeal_reviewed_at: Optional[datetime] = None
    chargeback_risk: Optional[float] = None

    @classmethod
    def from_orm_obj(cls, t) -> "TransactionOut":
        return cls(id=t.id, txn_id=f"TXN-{t.id:05d}", user_id=t.user_id,
                   amount=t.amount, description=t.description, status=t.status,
                   risk_score=t.risk_score, created_at=t.created_at,
                   fraud_explanation=t.fraud_explanation,
                   appeal_status=t.appeal_status,
                   appeal_reason=t.appeal_reason,
                   appeal_reviewed_by=t.appeal_reviewed_by,
                   appeal_reviewed_at=t.appeal_reviewed_at,
                   chargeback_risk=t.chargeback_risk)


class PaymentResponse(BaseModel):
    txn_id: str
    status: str
    risk_score: float
    message: str
    idempotency_key: str
    is_duplicate: bool = False
    provider_ref: Optional[str] = None
    fraud_explanation: Optional[Dict[str, Any]] = None
    step_up_required: bool = False
    challenge_id: Optional[str] = None
    dev_otp: Optional[str] = None


class StepUpVerifyRequest(BaseModel):
    challenge_id: str
    code: str


class ReviewRequest(BaseModel):
    action: str  # "approve" | "reject"

    @field_validator("action")
    @classmethod
    def _act(cls, v: str) -> str:
        if v not in ("approve", "reject"):
            raise ValueError("action must be 'approve' or 'reject'")
        return v


class RefundRequest(BaseModel):
    reason: str = ""

    @field_validator("reason")
    @classmethod
    def _r(cls, v: str) -> str:
        if len(v) > 300:
            raise ValueError("reason too long")
        return v
