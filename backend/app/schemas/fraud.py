from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator

class SignalContribution(BaseModel):
    signal_name: str
    raw_value: float
    weight: float
    impact: str  # "high", "medium", "low"
    description: str

class FraudExplanation(BaseModel):
    decision: str
    risk_score: float
    summary: str
    signals: List[SignalContribution]

class AppealRequest(BaseModel):
    reason: str
    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 10:
            raise ValueError("Appeal reason must be at least 10 characters")
        if len(v) > 1000:
            raise ValueError("Appeal reason too long (max 1000 chars)")
        return v

class AppealResponse(BaseModel):
    model_config = {"from_attributes": True}
    transaction_id: int
    txn_id: str
    amount: float
    status: str
    risk_score: float
    appeal_status: Optional[str] = None
    appeal_reason: Optional[str] = None
    appeal_reviewed_by: Optional[str] = None
    appeal_reviewed_at: Optional[datetime] = None
    fraud_explanation: Optional[dict] = None

class AppealReviewRequest(BaseModel):
    decision: str  # "approved" or "rejected"
    @field_validator("decision")
    @classmethod
    def valid_decision(cls, v: str) -> str:
        if v not in ("approved", "rejected"):
            raise ValueError("decision must be 'approved' or 'rejected'")
        return v
