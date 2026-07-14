"""Fraud Rules Engine — evaluates operator-authored rules alongside ML model."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.fraud_rule import FraudRule
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)


def _evaluate_condition(condition: dict, context: dict) -> bool:
    """Evaluate a single condition against the transaction context.

    Supports comparison operators: >, <, >=, <=, ==, !=.
    Returns False for unknown operators or missing fields.
    """
    field = condition["field"]
    op = condition["operator"]
    value = condition["value"]
    actual = context.get(field, 0)

    if op == ">":
        return actual > value
    if op == "<":
        return actual < value
    if op == ">=":
        return actual >= value
    if op == "<=":
        return actual <= value
    if op == "==":
        return actual == value
    if op == "!=":
        return actual != value
    return False


def evaluate_rule(rule_conditions: list, context: dict) -> bool:
    """Evaluate a list of conditions with optional combinators (and/or).

    The first condition is evaluated directly.  Subsequent conditions
    carry an optional ``combinator`` key (default ``"and"``).
    """
    if not rule_conditions:
        return False

    result = _evaluate_condition(rule_conditions[0], context)
    for cond in rule_conditions[1:]:
        combinator = cond.get("combinator", "and")
        cond_result = _evaluate_condition(cond, context)
        if combinator == "or":
            result = result or cond_result
        else:
            result = result and cond_result
    return result


def evaluate_rules(
    context: dict, db: Session
) -> Tuple[Optional[str], Optional[str]]:
    """Evaluate all active fraud rules against *context*.

    Returns ``(action, rule_name)`` for the most severe triggered rule,
    or ``(None, None)`` when no rule fires.  ``"block"`` beats ``"flag"``.
    """
    rules = (
        db.query(FraudRule).filter(FraudRule.is_active == True).all()  # noqa: E712
    )

    worst_action: Optional[str] = None
    trigger_rule: Optional[str] = None

    for rule in rules:
        try:
            conditions = (
                json.loads(rule.conditions)
                if isinstance(rule.conditions, str)
                else rule.conditions
            )
        except (json.JSONDecodeError, TypeError):
            continue

        if evaluate_rule(conditions, context):
            if rule.action == "block":
                return "BLOCKED", rule.name
            if rule.action == "flag" and worst_action != "BLOCKED":
                worst_action = "FLAGGED"
                trigger_rule = rule.name

    return worst_action, trigger_rule


def backtest_rule(rule_id: int, db: Session) -> dict:
    """Run a rule against historical transactions and return impact metrics.

    Returns a dict with hit counts, false-positive estimates, and a sample
    of up to 20 matching transactions.
    """
    from app.models.fraud_log import FraudLog

    rule = db.query(FraudRule).filter(FraudRule.id == rule_id).first()
    if not rule:
        return {"error": "Rule not found"}

    try:
        conditions = (
            json.loads(rule.conditions)
            if isinstance(rule.conditions, str)
            else rule.conditions
        )
    except (json.JSONDecodeError, TypeError):
        return {"error": "Invalid rule conditions"}

    transactions = (
        db.query(Transaction)
        .filter(Transaction.status != "PROCESSING")
        .all()
    )

    matches: List[dict] = []
    already_caught = 0
    false_positives = 0

    for txn in transactions:
        context = {
            "amount": txn.amount,
            "risk_score": txn.risk_score,
            "hour_of_day": txn.created_at.hour if txn.created_at else 12,
            "velocity_1h": 0,
            "velocity_24h": 0,
            "amount_zscore": 0.0,
        }
        if evaluate_rule(conditions, context):
            was_caught = txn.status in ("FLAGGED", "BLOCKED")
            if was_caught:
                already_caught += 1
            elif txn.status == "COMPLETED":
                false_positives += 1
            matches.append(
                {
                    "txn_id": f"TXN-{txn.id:05d}",
                    "amount": txn.amount,
                    "status": txn.status,
                    "risk_score": txn.risk_score,
                    "would_be": rule.action.upper()
                    + ("" if rule.action == "block" else "GED"),
                }
            )

    would_flag = len(matches) if rule.action == "flag" else 0
    would_block = len(matches) if rule.action == "block" else 0

    return {
        "rule_id": rule.id,
        "total_tested": len(transactions),
        "would_flag": would_flag,
        "would_block": would_block,
        "already_caught": already_caught,
        "false_positive_estimate": false_positives,
        "sample_matches": matches[:20],
    }
