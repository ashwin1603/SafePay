from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    email: str
    role: str
    created_at: datetime


class AdminStats(BaseModel):
    total_users: int
    total_transactions: int
    total_volume: float
    blocked_count: int
    flagged_count: int
    completed_count: int
    avg_risk_score: float
