"""Fraud Rules Studio — operator-authored rules with backtesting."""
from __future__ import annotations

import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_db, require_permission
from app.core.permissions import FRAUD_RULES_MANAGE, FRAUD_RULES_TEST
from app.models.fraud_rule import FraudRule
from app.schemas.fraud_rules import (
    BacktestResult,
    FraudRuleCreate,
    FraudRuleOut,
    FraudRuleUpdate,
)
from app.services.audit_service import record
from app.services.rules_engine import backtest_rule

router = APIRouter(prefix="/fraud-rules", tags=["Fraud Rules"])


# ------------------------------------------------------------------
# CRUD
# ------------------------------------------------------------------

@router.get("", response_model=List[FraudRuleOut])
def list_rules(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_MANAGE)),
):
    """Return every fraud rule, newest first."""
    rules = db.query(FraudRule).order_by(FraudRule.created_at.desc()).all()
    result: list[FraudRuleOut] = []
    for r in rules:
        out = FraudRuleOut.model_validate(r)
        try:
            out.conditions = (
                json.loads(r.conditions)
                if isinstance(r.conditions, str)
                else r.conditions
            )
        except (json.JSONDecodeError, TypeError):
            out.conditions = []
        result.append(out)
    return result


@router.post("", response_model=FraudRuleOut, status_code=201)
def create_rule(
    payload: FraudRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_MANAGE)),
):
    """Create a new fraud rule (initially inactive)."""
    rule = FraudRule(
        name=payload.name,
        description=payload.description,
        conditions=json.dumps([c.model_dump() for c in payload.conditions]),
        action=payload.action,
        is_active=False,
        created_by=principal.email,
    )
    db.add(rule)
    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="fraud_rule_create",
        ip=client_ip(request),
        target=rule.name,
        detail=f"action={rule.action} conditions={len(payload.conditions)}",
        commit=False,
    )
    db.commit()
    db.refresh(rule)
    out = FraudRuleOut.model_validate(rule)
    out.conditions = json.loads(rule.conditions)
    return out


@router.put("/{rule_id}", response_model=FraudRuleOut)
def update_rule(
    rule_id: int,
    payload: FraudRuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_MANAGE)),
):
    """Update an existing fraud rule's definition."""
    rule = db.query(FraudRule).filter(FraudRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.name = payload.name
    rule.description = payload.description
    rule.conditions = json.dumps([c.model_dump() for c in payload.conditions])
    rule.action = payload.action

    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="fraud_rule_update",
        ip=client_ip(request),
        target=rule.name,
        detail=f"rule_id={rule_id}",
        commit=False,
    )
    db.commit()
    db.refresh(rule)
    out = FraudRuleOut.model_validate(rule)
    out.conditions = json.loads(rule.conditions)
    return out


@router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_MANAGE)),
):
    """Delete a fraud rule permanently."""
    rule = db.query(FraudRule).filter(FraudRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="fraud_rule_delete",
        ip=client_ip(request),
        target=rule.name,
        detail=f"rule_id={rule_id}",
        commit=False,
    )
    db.delete(rule)
    db.commit()
    return {"detail": "Rule deleted"}


# ------------------------------------------------------------------
# Toggle & Backtest
# ------------------------------------------------------------------

@router.post("/{rule_id}/toggle", response_model=FraudRuleOut)
def toggle_rule(
    rule_id: int,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_MANAGE)),
):
    """Activate or deactivate a fraud rule."""
    rule = db.query(FraudRule).filter(FraudRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.is_active = not rule.is_active
    status_text = "activated" if rule.is_active else "deactivated"

    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="fraud_rule_toggle",
        ip=client_ip(request),
        target=rule.name,
        detail=f"rule_id={rule_id} -> {status_text}",
        commit=False,
    )
    db.commit()
    db.refresh(rule)
    out = FraudRuleOut.model_validate(rule)
    out.conditions = (
        json.loads(rule.conditions)
        if isinstance(rule.conditions, str)
        else rule.conditions
    )
    return out


@router.post("/{rule_id}/backtest", response_model=BacktestResult)
def run_backtest(
    rule_id: int,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(FRAUD_RULES_TEST)),
):
    """Run the rule against historical transactions and return metrics."""
    result = backtest_rule(rule_id, db)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
