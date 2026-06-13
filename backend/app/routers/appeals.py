"""Appeal endpoints — users appeal flagged/blocked transactions, operators review."""
from __future__ import annotations

from typing import List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_db, require_permission
from app.core.permissions import APPEAL_SUBMIT, APPEAL_REVIEW, TXN_READ_ALL
from app.core import permissions as perms
from app.models.transaction import Transaction
from app.schemas.fraud import AppealRequest, AppealResponse, AppealReviewRequest
from app.services.audit_service import record

router = APIRouter(prefix="/appeals", tags=["Appeals"])


def _can(principal, permission) -> bool:
    """Check whether *principal* holds a specific permission."""
    return perms.has_permission(getattr(principal, "role", ""), permission)


# ------------------------------------------------------------------
# Submit
# ------------------------------------------------------------------

@router.post("/transactions/{txn_id}", response_model=AppealResponse)
def submit_appeal(
    txn_id: int,
    payload: AppealRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(APPEAL_SUBMIT)),
):
    """Submit an appeal for a flagged or blocked transaction."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.user_id != principal.id:
        raise HTTPException(status_code=403, detail="Can only appeal your own transactions")
    if txn.status not in ("FLAGGED", "BLOCKED"):
        raise HTTPException(
            status_code=409,
            detail="Only FLAGGED or BLOCKED transactions can be appealed",
        )
    if txn.appeal_status == "pending":
        raise HTTPException(status_code=409, detail="Appeal already pending")

    txn.appeal_status = "pending"
    txn.appeal_reason = payload.reason

    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="appeal_submit",
        ip=client_ip(request),
        target=f"TXN-{txn.id:05d}",
        detail=f"reason={payload.reason[:100]}",
        commit=False,
    )
    db.commit()
    db.refresh(txn)
    return _to_response(txn)


# ------------------------------------------------------------------
# List
# ------------------------------------------------------------------

@router.get("", response_model=List[AppealResponse])
def list_appeals(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(APPEAL_REVIEW)),
):
    """Return all transactions that have an appeal (any status)."""
    txns = (
        db.query(Transaction)
        .filter(Transaction.appeal_status.isnot(None))
        .order_by(Transaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [_to_response(t) for t in txns]


@router.get("/pending", response_model=List[AppealResponse])
def list_pending_appeals(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(APPEAL_REVIEW)),
):
    """Return only pending appeals awaiting operator review."""
    txns = (
        db.query(Transaction)
        .filter(Transaction.appeal_status == "pending")
        .order_by(Transaction.created_at.desc())
        .all()
    )
    return [_to_response(t) for t in txns]


# ------------------------------------------------------------------
# Review
# ------------------------------------------------------------------

@router.put("/{txn_id}/review", response_model=AppealResponse)
def review_appeal(
    txn_id: int,
    payload: AppealReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(APPEAL_REVIEW)),
):
    """Operator approves or rejects a pending appeal."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.appeal_status != "pending":
        raise HTTPException(
            status_code=409, detail="No pending appeal for this transaction"
        )

    txn.appeal_status = payload.decision
    txn.appeal_reviewed_by = principal.email
    txn.appeal_reviewed_at = datetime.now(timezone.utc)
    if payload.decision == "approved":
        txn.status = "COMPLETED"

    record(
        db,
        actor=principal.email,
        actor_role=getattr(principal, "role", ""),
        action="appeal_review",
        ip=client_ip(request),
        target=f"TXN-{txn.id:05d}",
        detail=f"decision={payload.decision}",
        commit=False,
    )
    db.commit()
    db.refresh(txn)
    return _to_response(txn)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _to_response(txn: Transaction) -> AppealResponse:
    """Map a Transaction ORM instance to an AppealResponse schema."""
    return AppealResponse(
        transaction_id=txn.id,
        txn_id=f"TXN-{txn.id:05d}",
        amount=txn.amount,
        status=txn.status,
        risk_score=txn.risk_score,
        appeal_status=txn.appeal_status,
        appeal_reason=txn.appeal_reason,
        appeal_reviewed_by=txn.appeal_reviewed_by,
        appeal_reviewed_at=txn.appeal_reviewed_at,
        fraud_explanation=txn.fraud_explanation,
    )
