"""
SafePay Flow — FastAPI Entry Point
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.database import create_tables
from app.middleware.rate_limiter import RateLimitMiddleware
from app.routers import auth, transactions, payments, admin

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("safepay")

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="SafePay Flow API",
    description=(
        "AI-powered payment processing backend with JWT auth, "
        "IsolationForest fraud detection, and idempotent transaction management."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware, limit=settings.RATE_LIMIT_PER_MINUTE)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup() -> None:
    logger.info("SafePay Flow API starting up…")
    create_tables()
    logger.info("Database tables verified ✓")
    # Eagerly initialise fraud model so first request isn't slow
    from app.services.fraud_service import _get_model
    _get_model()
    logger.info("IsolationForest model ready ✓")


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(payments.router)
app.include_router(admin.router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SafePay Flow API", "version": "1.0.0"}
