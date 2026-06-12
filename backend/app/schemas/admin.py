from datetime import datetime

from pydantic import BaseModel


class UserOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime


class AdminStats(BaseModel):
    total_users: int
    total_transactions: int
    total_volume: float
    blocked_count: int
    flagged_count: int
    completed_count: int
    avg_risk_score: float


class RoleUpdate(BaseModel):
    role: str


class AuditOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    actor: str
    actor_role: str
    action: str
    target: str
    ip: str
    detail: str
    outcome: str
    created_at: datetime
