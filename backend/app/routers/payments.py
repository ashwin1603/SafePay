from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.payment_service import process_payment

router = APIRouter(prefix="/process-payment", tags=["Payments"])


@router.post("", response_model=PaymentResponse, status_code=200)
def submit_payment(
    payload: ProcessPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit a payment for processing.

    - Idempotency: repeated calls with the same `idempotency_key` return the
      original result without reprocessing.
    - Fraud: IsolationForest scores the transaction and determines final status.
    - Atomic: the entire flow (create record → score → update status → log) runs
      in a single DB transaction.
    """
    return process_payment(payload, db)
