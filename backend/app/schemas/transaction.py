from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class ProcessPaymentRequest(BaseModel):
    user_id: int
    amount: float
    description: str = ""
    idempotency_key: str

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
    def key_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("idempotency_key cannot be empty")
        if len(v) > 128:
            raise ValueError("idempotency_key too long (max 128 chars)")
        return v


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    txn_id: str          # formatted string "TXN-{id}"
    user_id: int
    amount: float
    description: str
    status: str
    risk_score: float
    idempotency_key: str
    created_at: datetime

    @classmethod
    def from_orm_obj(cls, txn) -> "TransactionOut":
        return cls(
            id=txn.id,
            txn_id=f"TXN-{txn.id:05d}",
            user_id=txn.user_id,
            amount=txn.amount,
            description=txn.description,
            status=txn.status,
            risk_score=txn.risk_score,
            idempotency_key=txn.idempotency_key,
            created_at=txn.created_at,
        )


class PaymentResponse(BaseModel):
    txn_id: str
    status: str
    risk_score: float
    message: str
    idempotency_key: str
    is_duplicate: bool = False


class TransactionFilter(BaseModel):
    status: Optional[str] = None
    user_id: Optional[int] = None
    limit: int = 50
    offset: int = 0
