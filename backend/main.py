"""SafePay — FastAPI entry point."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.database import create_tables
from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import (
    admin, auth, chatbot, payments, transactions,
    appeals, fraud_rules, consortium_router, analytics, simulation, chargeback
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("safepay")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SafePay starting in %s mode…", settings.ENVIRONMENT)
    create_tables()
    from app.services.fraud_service import _get_model
    _get_model()
    logger.info("Fraud model ready ✓  Payment provider: %s", settings.PAYMENT_PROVIDER)
    yield

# In production, never expose interactive docs publicly.
_docs = None if settings.is_production else "/docs"
_redoc = None if settings.is_production else "/redoc"

app = FastAPI(
    title="SafePay API",
    description="Secure payment gateway: JWT auth, RBAC, AI fraud detection, "
                "tokenized payments, audit logging and an offline assistant.",
    version="2.0.0",
    docs_url=_docs,
    redoc_url=_redoc,
    lifespan=lifespan,
)

# ── Middleware (order matters: last added runs first) ─────────────────────────
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, limit=settings.RATE_LIMIT_PER_MINUTE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,         # explicit allow-list, no "*"
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Break-Glass-Token"],
)


app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(payments.router)
app.include_router(admin.router)
app.include_router(chatbot.router)
app.include_router(appeals.router)
app.include_router(fraud_rules.router)
app.include_router(consortium_router.router)
app.include_router(analytics.router)
app.include_router(simulation.router)
app.include_router(chargeback.router)


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SafePay API", "version": "2.0.0",
            "environment": settings.ENVIRONMENT}
