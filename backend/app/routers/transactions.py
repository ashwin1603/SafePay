from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core import permissions as perms
from app.core.dependencies import client_ip, get_db, require_permission
from app.models.transaction import Transaction
from app.schemas.transaction import (
    RefundRequest, ReviewRequest, TransactionOut,
)
from app.services.audit_service import record

router = APIRouter(prefix="/transactions", tags=["Transactions"])

_VALID_STATUS = {"PROCESSING", "COMPLETED", "FLAGGED", "BLOCKED", "DECLINED", "REFUNDED"}


def _can(principal, permission) -> bool:
    return perms.has_permission(getattr(principal, "role", ""), permission)


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: Optional[int] = Query(None, description="requires transaction:read:all"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    principal=Depends(require_permission(perms.TXN_READ_OWN)),
):
    q = db.query(Transaction)
    if _can(principal, perms.TXN_READ_ALL):
        if user_id is not None:
            q = q.filter(Transaction.user_id == user_id)
    else:
        # account holders only ever see their own rows
        q = q.filter(Transaction.user_id == principal.id)

    if status_filter:
        sf = status_filter.upper()
        if sf not in _VALID_STATUS:
            raise HTTPException(status_code=422, detail="invalid status filter")
        q = q.filter(Transaction.status == sf)

    rows = q.order_by(Transaction.created_at.desc(), Transaction.id.desc()).offset(offset).limit(limit).all()
    return [TransactionOut.from_orm_obj(t) for t in rows]


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(txn_id: int, db: Session = Depends(get_db),
                    principal=Depends(require_permission(perms.TXN_READ_OWN))):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can(principal, perms.TXN_READ_ALL) and txn.user_id != principal.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return TransactionOut.from_orm_obj(txn)


@router.post("/{txn_id}/review", response_model=TransactionOut)
def review_transaction(txn_id: int, payload: ReviewRequest, request: Request,
                       db: Session = Depends(get_db),
                       principal=Depends(require_permission(perms.TXN_REVIEW))):
    """Operator/admin: approve or reject a FLAGGED transaction."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Not found")
    if txn.status != "FLAGGED":
        raise HTTPException(status_code=409, detail="Only FLAGGED transactions can be reviewed")
    txn.status = "COMPLETED" if payload.action == "approve" else "BLOCKED"
    record(db, actor=principal.email, actor_role=getattr(principal, "role", ""),
           action="txn_review", ip=client_ip(request), target=f"TXN-{txn.id:05d}",
           detail=f"{payload.action} -> {txn.status}", commit=False)
    db.commit(); db.refresh(txn)
    return TransactionOut.from_orm_obj(txn)


@router.post("/{txn_id}/refund", response_model=TransactionOut)
def refund_transaction(txn_id: int, payload: RefundRequest, request: Request,
                       db: Session = Depends(get_db),
                       principal=Depends(require_permission(perms.TXN_REFUND))):
    """Operator/admin: refund a COMPLETED transaction."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Not found")
    if txn.status != "COMPLETED":
        raise HTTPException(status_code=409, detail="Only COMPLETED transactions can be refunded")
    txn.status = "REFUNDED"
    record(db, actor=principal.email, actor_role=getattr(principal, "role", ""),
           action="txn_refund", ip=client_ip(request), target=f"TXN-{txn.id:05d}",
           detail=payload.reason or "", commit=False)
    db.commit(); db.refresh(txn)
    return TransactionOut.from_orm_obj(txn)
