"""Real-Time Fraud Analytics & Model Observability endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_permission
from app.core.permissions import ANALYTICS_VIEW
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/risk-distribution")
def get_risk_distribution(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(ANALYTICS_VIEW)),
):
    """Return the distribution of risk scores across transactions."""
    return analytics_service.risk_distribution(db)


@router.get("/rates")
def get_rates(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(ANALYTICS_VIEW)),
):
    """Return fraud / approval / block rates over time."""
    return analytics_service.rates_over_time(db)


@router.get("/top-signals")
def get_top_signals(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(ANALYTICS_VIEW)),
):
    """Return the most frequently triggered fraud signals."""
    return analytics_service.top_signals(db)


@router.get("/model-drift")
def get_model_drift(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(ANALYTICS_VIEW)),
):
    """Return model drift metrics for observability monitoring."""
    return analytics_service.model_drift(db)


@router.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    principal=Depends(require_permission(ANALYTICS_VIEW)),
):
    """Return a high-level analytics summary dashboard payload."""
    return analytics_service.summary(db)
