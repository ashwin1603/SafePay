"""Step-Up Authentication — risk-adaptive second-factor challenge."""
from __future__ import annotations

import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class Challenge:
    """Represents a pending step-up authentication challenge."""

    challenge_id: str
    user_id: int
    code: str
    txn_context: Dict[str, Any]
    created_at: float
    expires_at: float
    verified: bool = False


# In-memory challenge store (suitable for single-process / dev; swap for
# Redis in production).
_challenges: Dict[str, Challenge] = {}
_CHALLENGE_TTL = 300  # 5 minutes


def create_challenge(user_id: int, txn_context: dict) -> Challenge:
    """Issue a new 6-digit OTP challenge for *user_id*.

    The challenge is stored in-memory and expires after
    ``_CHALLENGE_TTL`` seconds.  The generated code is logged at INFO
    level for development convenience.
    """
    challenge_id = secrets.token_urlsafe(24)
    code = f"{secrets.randbelow(1000000):06d}"
    now = time.time()
    challenge = Challenge(
        challenge_id=challenge_id,
        user_id=user_id,
        code=code,
        txn_context=txn_context,
        created_at=now,
        expires_at=now + _CHALLENGE_TTL,
    )
    _challenges[challenge_id] = challenge
    _cleanup_expired()
    from app.core.config import settings
    if settings.ENVIRONMENT != "production":
        logger.debug(
            "Step-up challenge created for user %d (dev code: %s)",
            user_id,
            code,
        )
    return challenge


def verify_challenge(
    challenge_id: str, code: str, user_id: int
) -> Optional[Challenge]:
    """Verify a step-up challenge.

    Returns the ``Challenge`` on success, or ``None`` if the challenge
    is invalid, expired, already used, or the code doesn't match.
    Uses constant-time comparison to avoid timing side-channels.
    """
    _cleanup_expired()
    challenge = _challenges.get(challenge_id)
    if not challenge:
        return None
    if challenge.user_id != user_id:
        return None
    if challenge.verified:
        return None
    if time.time() > challenge.expires_at:
        del _challenges[challenge_id]
        return None
    if not secrets.compare_digest(challenge.code, code):
        return None

    challenge.verified = True
    del _challenges[challenge_id]
    return challenge


def _cleanup_expired() -> None:
    """Remove all expired challenges from the in-memory store."""
    now = time.time()
    expired = [k for k, v in _challenges.items() if now > v.expires_at]
    for k in expired:
        del _challenges[k]
