from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.dependencies import client_ip, get_db, require_permission
from app.core.permissions import PAYMENT_CREATE
from app.schemas.transaction import PaymentResponse, ProcessPaymentRequest
from app.services.payment_service import process_payment

router = APIRouter(prefix="/process-payment", tags=["Payments"])


@router.post("", response_model=PaymentResponse, status_code=200)
def submit_payment(payload: ProcessPaymentRequest, request: Request,
                   db: Session = Depends(get_db),
                   principal=Depends(require_permission(PAYMENT_CREATE))):
    """Submit a payment. Requires the payment:create permission. The payer is the
    authenticated principal (no spoofable id)."""
    return process_payment(payload, user_id=principal.id,
                           user_email=principal.email, db=db,
                           ip=client_ip(request))
