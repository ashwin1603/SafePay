from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core import roles
from app.core.dependencies import get_current_user, get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionOut

router = APIRouter(prefix="/transactions", tags=["Transactions"])

_VALID_STATUS = {"PROCESSING", "COMPLETED", "FLAGGED", "BLOCKED", "DECLINED"}


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    status_filter: Optional[str] = Query(None, alias="status"),
    user_id: Optional[int] = Query(None, description="admin only"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Transaction)
    if not roles.at_least(current_user.role, roles.ADMIN):
        q = q.filter(Transaction.user_id == current_user.id)  # own rows only
    elif user_id is not None:
        q = q.filter(Transaction.user_id == user_id)

    if status_filter:
        sf = status_filter.upper()
        if sf not in _VALID_STATUS:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                                detail="invalid status filter")
        q = q.filter(Transaction.status == sf)

    rows = q.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    return [TransactionOut.from_orm_obj(t) for t in rows]


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(txn_id: int, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not roles.at_least(current_user.role, roles.ADMIN) and txn.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return TransactionOut.from_orm_obj(txn)
