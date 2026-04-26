from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_admin
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.admin import AdminStats, UserOut
from app.services.fraud_service import retrain_from_db

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=List[UserOut])
def list_users(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all registered users (admin only)."""
    return db.query(User).order_by(User.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/stats", response_model=AdminStats)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Aggregate dashboard statistics for admin panel."""
    total_users = db.query(func.count(User.id)).scalar() or 0

    txn_q = db.query(Transaction)
    total_txns = txn_q.count()

    total_volume = db.query(func.sum(Transaction.amount)).scalar() or 0.0
    avg_risk = db.query(func.avg(Transaction.risk_score)).scalar() or 0.0

    blocked = txn_q.filter(Transaction.status == "BLOCKED").count()
    flagged = txn_q.filter(Transaction.status == "FLAGGED").count()
    completed = txn_q.filter(Transaction.status == "COMPLETED").count()

    return AdminStats(
        total_users=total_users,
        total_transactions=total_txns,
        total_volume=round(float(total_volume), 2),
        blocked_count=blocked,
        flagged_count=flagged,
        completed_count=completed,
        avg_risk_score=round(float(avg_risk), 4),
    )


@router.post("/retrain", status_code=200)
def retrain_model(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Re-train the IsolationForest model on live transaction data."""
    message = retrain_from_db(db)
    return {"message": message}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    """Delete a user account (admin only, cannot delete self)."""
    if user_id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()
