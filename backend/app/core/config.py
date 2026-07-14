"""
Application configuration.

All secrets are loaded from the environment (.env in dev, real secret manager in
prod). There is intentionally NO usable default for JWT_SECRET_KEY: if it is
missing in a production environment the app refuses to start, so a weak default
secret can never reach production.
"""

import secrets
from typing import List, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Environment ───────────────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # ── Auth / JWT ────────────────────────────────────────────────────────────
    # In dev a random per-process key is generated if none is supplied (tokens
    # simply won't survive a restart). In prod a real key is mandatory.
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15          # short-lived access token
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "safepay"
    JWT_AUDIENCE: str = "safepay-api"

    # ── Login protection ──────────────────────────────────────────────────────
    MAX_FAILED_LOGINS: int = 5
    LOCKOUT_MINUTES: int = 15

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./safepay.db"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 60

    # ── CORS (explicit allow-list, no wildcards) ──────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
    ]

    # ── Trusted hosts (Host-header / DNS-rebinding protection) ─────────────────
    TRUSTED_HOSTS: List[str] = ["localhost", "127.0.0.1", "testserver"]

    # ── Fraud thresholds ──────────────────────────────────────────────────────
    FRAUD_BLOCK_THRESHOLD: float = 0.8
    FRAUD_FLAG_THRESHOLD: float = 0.5

    # ── Payments ──────────────────────────────────────────────────────────────
    # "simulated" = built-in mock processor (no real money, default).
    # "stripe"    = real Stripe PaymentIntents. STRIPE_SECRET_KEY must be a
    #               test key (sk_test_...) unless ENVIRONMENT=production AND
    #               ALLOW_LIVE_PAYMENTS is explicitly true.
    PAYMENT_PROVIDER: Literal["simulated", "stripe"] = "simulated"
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    ALLOW_LIVE_PAYMENTS: bool = False
    MAX_TXN_AMOUNT: float = 1_000_000.0

    # ── Cashfree Payments (sandbox) ───────────────────────────────────────────
    # Obtain test credentials from https://merchant.cashfree.com (switch to Test mode).
    # Keys always start with TEST_ in sandbox.
    CASHFREE_APP_ID: str = ""
    CASHFREE_SECRET_KEY: str = ""

    # ── Break-glass (audited emergency access — NOT a hidden backdoor) ─────────
    # Disabled unless an operator deliberately sets a strong token in the env.
    # Every use is written to the audit log.
    BREAK_GLASS_ENABLED: bool = False
    BREAK_GLASS_TOKEN: str = ""           # min 32 chars; compared in constant time
    BREAK_GLASS_EMAIL: str = "break-glass@safepay.local"

    # ── Step-up authentication (risk-adaptive 2FA) ────────────────────────────
    STEPUP_THRESHOLD: float = 0.35        # below FLAG — triggers step-up challenge

    # ── Consortium (privacy-preserving shared fraud signals) ──────────────────
    CONSORTIUM_ENABLED: bool = False
    CONSORTIUM_PEERS: List[str] = []
    CONSORTIUM_SECRET: str = ""

    @field_validator("JWT_SECRET_KEY", mode="after")
    @classmethod
    def _validate_secret(cls, v: str, info) -> str:
        env = info.data.get("ENVIRONMENT", "development")
        if not v:
            if env == "production":
                raise RuntimeError(
                    "JWT_SECRET_KEY must be set in production. Refusing to start."
                )
            # Dev convenience: ephemeral strong key.
            return secrets.token_urlsafe(48)
        if len(v) < 32:
            raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters.")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
