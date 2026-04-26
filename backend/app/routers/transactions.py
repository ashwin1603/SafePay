from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionOut

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionOut])
def list_transactions(
    status: Optional[str] = Query(None, description="Filter by status: COMPLETED, FLAGGED, BLOCKED, PROCESSING"),
    user_id: Optional[int] = Query(None, description="Filter by user ID (admin only)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List transactions.
    - Regular users see only their own transactions.
    - Admins can filter by any user_id.
    """
    q = db.query(Transaction)

    if current_user.role != "admin":
        # Non-admins can only see their own
        q = q.filter(Transaction.user_id == current_user.id)
    elif user_id is not None:
        q = q.filter(Transaction.user_id == user_id)

    if status:
        q = q.filter(Transaction.status == status.upper())

    txns = q.order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    return [TransactionOut.from_orm_obj(t) for t in txns]


@router.get("/{txn_id}", response_model=TransactionOut)
def get_transaction(
    txn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve a single transaction by numeric ID."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    if current_user.role != "admin" and txn.user_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return TransactionOut.from_orm_obj(txn)
