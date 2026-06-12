from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_current_user, get_db
from app.models.user import User
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.payment_service import process_payment

router = APIRouter(prefix="/process-payment", tags=["Payments"])


@router.post("", response_model=PaymentResponse, status_code=200)
def submit_payment(payload: ProcessPaymentRequest, request: Request,
                   db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    """Submit a payment. The payer is the authenticated user (no spoofable id)."""
    return process_payment(payload, user_id=current_user.id,
                           user_email=current_user.email, db=db,
                           ip=client_ip(request))
