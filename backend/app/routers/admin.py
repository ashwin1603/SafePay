from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import permissions as perms
from app.core import roles
from app.core.dependencies import client_ip, get_db, require_permission
from app.models.audit_log import AuditLog
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.admin import AdminStats, AuditOut, RoleUpdate, UserOut
from app.services.audit_service import record
from app.services.fraud_service import retrain_from_db

router = APIRouter(prefix="/admin", tags=["Admin"])


def _actor(p) -> str:
    return getattr(p, "email", "break-glass")


@router.get("/users", response_model=List[UserOut])
def list_users(limit: int = 100, offset: int = 0, db: Session = Depends(get_db),
               _=Depends(require_permission(perms.USER_READ))):
    return db.query(User).order_by(User.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/stats", response_model=AdminStats)
def get_stats(db: Session = Depends(get_db),
              _=Depends(require_permission(perms.STATS_READ))):
    total_users = db.query(func.count(User.id)).scalar() or 0
    txn_q = db.query(Transaction)
    return AdminStats(
        total_users=total_users,
        total_transactions=txn_q.count(),
        total_volume=round(float(db.query(func.sum(Transaction.amount)).scalar() or 0.0), 2),
        blocked_count=txn_q.filter(Transaction.status == "BLOCKED").count(),
        flagged_count=txn_q.filter(Transaction.status == "FLAGGED").count(),
        completed_count=txn_q.filter(Transaction.status == "COMPLETED").count(),
        avg_risk_score=round(float(db.query(func.avg(Transaction.risk_score)).scalar() or 0.0), 4),
    )


@router.get("/audit", response_model=List[AuditOut])
def list_audit(limit: int = 100, offset: int = 0, db: Session = Depends(get_db),
               _=Depends(require_permission(perms.AUDIT_READ))):
    return (db.query(AuditLog).order_by(AuditLog.created_at.desc())
            .offset(offset).limit(limit).all())


@router.post("/retrain", status_code=200)
def retrain_model(request: Request, db: Session = Depends(get_db),
                  principal=Depends(require_permission(perms.MODEL_RETRAIN))):
    msg = retrain_from_db(db)
    record(db, actor=_actor(principal), actor_role=getattr(principal, "role", ""),
           action="model_retrain", ip=client_ip(request), detail=msg)
    return {"message": msg}


@router.put("/users/{user_id}/role", response_model=UserOut)
def set_role(user_id: int, payload: RoleUpdate, request: Request,
             db: Session = Depends(get_db),
             principal=Depends(require_permission(perms.USER_SET_ROLE))):
    if payload.role not in roles.ALL_ROLES:
        raise HTTPException(status_code=422, detail="invalid role")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old = user.role
    user.role = payload.role
    db.commit(); db.refresh(user)
    record(db, actor=_actor(principal), actor_role=getattr(principal, "role", ""),
           action="role_change", ip=client_ip(request), target=user.email,
           detail=f"{old} -> {payload.role}")
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db),
                principal=Depends(require_permission(perms.USER_DELETE))):
    if user_id == getattr(principal, "id", -999):
        raise HTTPException(status_code=400, detail="Cannot delete own account")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    record(db, actor=_actor(principal), actor_role=getattr(principal, "role", ""),
           action="user_delete", ip=client_ip(request), target=user.email, commit=False)
    db.delete(user); db.commit()
