from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

class ChargebackRiskFactors(BaseModel):
    risk_score_at_payment: float
    amount_zscore: float
    velocity_factor: float
    time_of_day_risk: float
    is_first_transaction: bool
    amount_vs_user_mean: float

class ChargebackPrediction(BaseModel):
    transaction_id: int
    txn_id: str
    amount: float
    status: str
    chargeback_probability: float
    risk_level: str  # low, medium, high, critical
    risk_factors: ChargebackRiskFactors
    created_at: datetime

class ChargebackSummary(BaseModel):
    total_scanned: int
    high_risk_count: int
    predictions: List[ChargebackPrediction]
