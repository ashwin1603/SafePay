"""Chargeback / Dispute Prediction endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import CHARGEBACK_VIEW
from app.models.transaction import Transaction
from app.services import chargeback_service

router = APIRouter(prefix="/chargeback", tags=["Chargeback"])


@router.get("/predictions")
def get_predictions(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(CHARGEBACK_VIEW)),
):
    """Scan recent completed transactions and return chargeback risk predictions."""
    return chargeback_service.scan_recent(db)


@router.get("/predictions/{txn_id}")
def get_prediction(
    txn_id: int,
    db: Session = Depends(get_db),
    principal=Depends(require_permission(CHARGEBACK_VIEW)),
):
    """Return a chargeback prediction for a single completed transaction."""
    txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != "COMPLETED":
        raise HTTPException(
            status_code=409,
            detail="Only COMPLETED transactions can be analyzed",
        )
    return chargeback_service.predict_for_transaction(txn, db)
