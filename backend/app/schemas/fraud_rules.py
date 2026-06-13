from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator

class RuleCondition(BaseModel):
    field: str  # amount, velocity_1h, amount_zscore, hour_of_day, risk_score, currency
    operator: str  # >, <, >=, <=, ==, !=
    value: float
    combinator: str = "and"  # "and" or "or"
    @field_validator("field")
    @classmethod
    def valid_field(cls, v):
        allowed = {"amount", "velocity_1h", "velocity_24h", "amount_zscore", "hour_of_day", "risk_score", "currency"}
        if v not in allowed:
            raise ValueError(f"field must be one of {allowed}")
        return v
    @field_validator("operator")
    @classmethod
    def valid_op(cls, v):
        if v not in (">", "<", ">=", "<=", "==", "!="):
            raise ValueError("invalid operator")
        return v

class FraudRuleCreate(BaseModel):
    name: str
    description: str = ""
    conditions: List[RuleCondition]
    action: str = "flag"
    @field_validator("name")
    @classmethod
    def name_ok(cls, v):
        v = v.strip()
        if not v or len(v) > 100:
            raise ValueError("name required, max 100 chars")
        return v
    @field_validator("action")
    @classmethod
    def action_ok(cls, v):
        if v not in ("flag", "block"):
            raise ValueError("action must be 'flag' or 'block'")
        return v

class FraudRuleUpdate(FraudRuleCreate):
    pass

class FraudRuleOut(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    name: str
    description: str
    conditions: Any
    action: str
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class BacktestResult(BaseModel):
    rule_id: int
    total_tested: int
    would_flag: int
    would_block: int
    already_caught: int
    false_positive_estimate: int
    sample_matches: List[Dict[str, Any]]
