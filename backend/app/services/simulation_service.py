"""Attack-Mode Simulation Sandbox — synthetic attack pattern generation."""
from __future__ import annotations

import logging
import math
import random
from dataclasses import dataclass
from typing import List

from app.services.fraud_service import assess_fraud_simulated

logger = logging.getLogger(__name__)

SCENARIOS: dict[str, dict] = {
    "card_testing": {
        "name": "Card Testing Attack",
        "description": (
            "Many small transactions ($0.50-$2.00) in rapid succession "
            "to test stolen card validity"
        ),
        "default_count": 20,
    },
    "velocity_burst": {
        "name": "Velocity Burst",
        "description": (
            "20+ transactions in under a minute from the same account "
            "— typical of bot-driven fraud"
        ),
        "default_count": 25,
    },
    "account_takeover": {
        "name": "Account Takeover",
        "description": (
            "Normal user suddenly makes large unusual transactions "
            "— pattern of compromised credentials"
        ),
        "default_count": 10,
    },
    "high_value_fraud": {
        "name": "High-Value Fraud",
        "description": (
            "Single very large transaction with anomalous features "
            "— classic fraud attempt"
        ),
        "default_count": 5,
    },
}


# ------------------------------------------------------------------
# Synthetic data generators
# ------------------------------------------------------------------

def _gen_card_testing(count: int) -> List[dict]:
    """Generate many micro-value transactions."""
    return [
        {
            "amount": round(random.uniform(0.50, 2.00), 2),
            "hour": random.randint(1, 5),
            "velocity": count,
            "zscore": 0.5,
        }
        for _ in range(count)
    ]


def _gen_velocity_burst(count: int) -> List[dict]:
    """Generate a burst of mid-range transactions with escalating velocity."""
    return [
        {
            "amount": round(random.uniform(50, 500), 2),
            "hour": random.randint(0, 23),
            "velocity": count + i,
            "zscore": 1.0,
        }
        for i in range(count)
    ]


def _gen_account_takeover(count: int) -> List[dict]:
    """Generate a mix of normal then anomalous high-value transactions."""
    txns: List[dict] = []
    for i in range(count):
        if i < 3:
            txns.append(
                {
                    "amount": round(random.uniform(20, 100), 2),
                    "hour": 14,
                    "velocity": 1,
                    "zscore": 0.2,
                }
            )
        else:
            txns.append(
                {
                    "amount": round(random.uniform(3000, 15000), 2),
                    "hour": 3,
                    "velocity": i,
                    "zscore": random.uniform(4, 8),
                }
            )
    return txns


def _gen_high_value(count: int) -> List[dict]:
    """Generate very large transactions with extreme z-scores."""
    return [
        {
            "amount": round(random.uniform(10000, 50000), 2),
            "hour": random.randint(0, 4),
            "velocity": 1,
            "zscore": random.uniform(5, 10),
        }
        for _ in range(count)
    ]


_GENERATORS = {
    "card_testing": _gen_card_testing,
    "velocity_burst": _gen_velocity_burst,
    "account_takeover": _gen_account_takeover,
    "high_value_fraud": _gen_high_value,
}


# ------------------------------------------------------------------
# Public API
# ------------------------------------------------------------------

def run_simulation(scenario: str, count: int) -> dict:
    """Execute an attack simulation and return catch-rate metrics.

    Parameters
    ----------
    scenario:
        One of the keys in ``SCENARIOS``.
    count:
        Number of synthetic transactions to generate.

    Returns
    -------
    dict with per-transaction results, aggregate catch rate, and
    scenario metadata.

    Raises
    ------
    ValueError
        If *scenario* is not a recognised attack pattern.
    """
    if scenario not in SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario}")

    info = SCENARIOS[scenario]
    gen = _GENERATORS[scenario]
    synthetic_txns = gen(count)

    results: List[dict] = []
    caught = 0

    for i, txn in enumerate(synthetic_txns):
        result = assess_fraud_simulated(
            amount=txn["amount"],
            hour_of_day=txn["hour"],
            txn_count_1h=txn["velocity"],
            amount_zscore=txn["zscore"],
        )
        is_caught = result.decision in ("FLAGGED", "BLOCKED")
        if is_caught:
            caught += 1
        results.append(
            {
                "index": i + 1,
                "amount": txn["amount"],
                "risk_score": result.risk_score,
                "decision": result.decision,
                "caught": is_caught,
                "explanation": result.reason,
            }
        )

    return {
        "scenario": scenario,
        "scenario_description": info["description"],
        "total": len(results),
        "caught": caught,
        "missed": len(results) - caught,
        "catch_rate": round(caught / max(len(results), 1) * 100, 1),
        "transactions": results,
    }
