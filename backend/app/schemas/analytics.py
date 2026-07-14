from __future__ import annotations
from typing import Any, Dict, List
from pydantic import BaseModel

class RiskBucket(BaseModel):
    range_label: str
    count: int
    percentage: float

class RiskDistribution(BaseModel):
    buckets: List[RiskBucket]
    total: int

class RatePoint(BaseModel):
    period: str
    completed: int
    flagged: int
    blocked: int
    total: int

class SignalFrequency(BaseModel):
    signal_name: str
    fire_count: int
    percentage: float

class ModelDrift(BaseModel):
    ks_statistic: float
    p_value: float
    is_drifting: bool
    message: str

class AnalyticsSummary(BaseModel):
    risk_distribution: RiskDistribution
    rates: List[RatePoint]
    top_signals: List[SignalFrequency]
    drift: ModelDrift
    total_transactions: int
    avg_risk_score: float
    block_rate: float
    flag_rate: float
