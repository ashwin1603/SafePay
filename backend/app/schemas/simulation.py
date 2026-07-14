from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator

class SimulationRequest(BaseModel):
    scenario: str
    count: int = 20
    @field_validator("scenario")
    @classmethod
    def valid_scenario(cls, v):
        allowed = {"card_testing", "velocity_burst", "account_takeover", "high_value_fraud"}
        if v not in allowed:
            raise ValueError(f"scenario must be one of {allowed}")
        return v
    @field_validator("count")
    @classmethod
    def count_ok(cls, v):
        if v < 1 or v > 100:
            raise ValueError("count must be 1-100")
        return v

class SimulationTxnResult(BaseModel):
    index: int
    amount: float
    risk_score: float
    decision: str
    caught: bool
    explanation: Optional[str] = None

class SimulationResult(BaseModel):
    scenario: str
    scenario_description: str
    total: int
    caught: int
    missed: int
    catch_rate: float
    transactions: List[SimulationTxnResult]

class ScenarioInfo(BaseModel):
    id: str
    name: str
    description: str
    default_count: int
