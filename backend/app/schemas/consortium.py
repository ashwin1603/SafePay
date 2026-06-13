from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel

class BloomFilterExport(BaseModel):
    filter_base64: str
    size_bits: int
    hash_count: int
    item_count: int
    fill_ratio: float

class BloomFilterImport(BaseModel):
    filter_base64: str
    size_bits: int
    hash_count: int
    peer_id: str

class ConsortiumStatus(BaseModel):
    enabled: bool
    local_filter_size: int
    local_item_count: int
    local_fill_ratio: float
    peer_count: int
    peers: List[str]

class SignalCheckRequest(BaseModel):
    hashed_signals: List[str]

class SignalCheckResponse(BaseModel):
    matches: List[dict]
    total_checked: int
    total_matches: int
