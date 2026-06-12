"""
Payment provider abstraction.

The server NEVER receives raw card numbers. It only ever passes an opaque token
(produced client-side by the processor) to the provider. This keeps the server
out of PCI-DSS cardholder-data scope (SAQ-A model).

Providers:
  - simulated : deterministic mock processor for dev/demo (no money moves).
  - stripe    : real Stripe PaymentIntents. Refuses to use a live key unless
                ENVIRONMENT=production AND ALLOW_LIVE_PAYMENTS=true.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass

from app.core.config import settings

logger = logging.getLogger("safepay.payments")


@dataclass
class ChargeResult:
    ok: bool
    provider_ref: str
    detail: str = ""


def _charge_simulated(amount: float, card_token: str | None) -> ChargeResult:
    # Deterministic test hooks; never touches a network or real funds.
    if card_token == "tok_decline":
        return ChargeResult(False, "sim_declined", "card declined (simulated)")
    return ChargeResult(True, f"sim_{uuid.uuid4().hex[:16]}", "simulated capture")


def _charge_stripe(amount: float, card_token: str | None) -> ChargeResult:
    key = settings.STRIPE_SECRET_KEY
    if not key:
        raise RuntimeError("PAYMENT_PROVIDER=stripe but STRIPE_SECRET_KEY is unset")
    is_live = key.startswith("sk_live_")
    if is_live and not (settings.is_production and settings.ALLOW_LIVE_PAYMENTS):
        # Guard rail: never move real money unless explicitly, deliberately enabled.
        raise RuntimeError(
            "Live Stripe key detected but live payments are not enabled. "
            "Set ENVIRONMENT=production and ALLOW_LIVE_PAYMENTS=true after "
            "completing the go-live checklist."
        )
    try:
        import stripe  # imported lazily so the dep is optional in dev
    except ImportError as e:  # pragma: no cover
        raise RuntimeError("stripe package not installed") from e

    stripe.api_key = key
    intent = stripe.PaymentIntent.create(
        amount=int(round(amount * 100)),  # cents
        currency="usd",
        payment_method=card_token,
        confirm=True,
        automatic_payment_methods={"enabled": True, "allow_redirects": "never"},
        idempotency_key=f"pi_{uuid.uuid4().hex}",
    )
    ok = intent.status in ("succeeded", "requires_capture")
    return ChargeResult(ok, intent.id, f"stripe status={intent.status}")


def charge(amount: float, card_token: str | None) -> ChargeResult:
    if settings.PAYMENT_PROVIDER == "stripe":
        return _charge_stripe(amount, card_token)
    return _charge_simulated(amount, card_token)
