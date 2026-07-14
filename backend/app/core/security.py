"""
Cryptographic helpers: password hashing and JWT issue/verify.

- Passwords: bcrypt directly (constant-time verify).
- Tokens: short-lived access tokens + longer refresh tokens, each with a unique
  jti, typed ("access"/"refresh"), and bound to an issuer + audience so a token
  minted for one purpose/service cannot be replayed elsewhere.
"""

from __future__ import annotations

import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import jwt

from app.core.config import settings

# ── Passwords ────────────────────────────────────────────────────────────────

_COMMON = {"password", "12345678", "qwerty123", "letmein1", "admin123", "password1"}


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def validate_password_policy(pw: str) -> None:
    """Raise ValueError if the password is too weak."""
    if len(pw) < 10:
        raise ValueError("Password must be at least 10 characters")
    if pw.lower() in _COMMON:
        raise ValueError("Password is too common")
    classes = sum(
        bool(re.search(p, pw))
        for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]")
    )
    if classes < 3:
        raise ValueError(
            "Password must include at least 3 of: lowercase, uppercase, digit, symbol"
        )


def constant_time_compare(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


# ── JWT ──────────────────────────────────────────────────────────────────────

def _create_token(subject: str, role: str, token_type: str, ttl: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "iat": now,
        "nbf": now,
        "exp": now + ttl,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, role: str,
                        expires_delta: Optional[timedelta] = None) -> str:
    return _create_token(
        subject, role, "access",
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str, role: str) -> str:
    return _create_token(
        subject, role, "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str, expected_type: str = "access") -> dict:
    """Decode + validate signature, exp, nbf, issuer, audience and token type."""
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={"require": ["exp", "iat", "sub"]},
    )
    if payload.get("type") != expected_type:
        from jose import JWTError
        raise JWTError(f"Expected {expected_type} token")
    return payload
