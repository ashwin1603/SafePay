"""
Request dependencies: DB session, current-user resolution, and role guards.

Authentication accepts a normal Bearer JWT. In addition, role guards support an
audited *break-glass* path (see SECURITY.md): if BREAK_GLASS_ENABLED and a valid
X-Break-Glass-Token header is presented, the caller is treated as an emergency
admin AND every such request is written to the audit log. This is deliberately
NOT a hidden backdoor — it is disabled by default, requires a strong operator-set
token, and is fully traceable.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Generator, Optional

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core import permissions as perms
from app.core import roles
from app.core.config import settings
from app.core.security import constant_time_compare, decode_token
from app.database import SessionLocal
from app.models.user import User
from app.services.audit_service import record


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _bearer_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = _bearer_token(request)
    if not token:
        raise exc
    try:
        payload = decode_token(token, expected_type="access")
        user_id = payload.get("sub")
        if user_id is None:
            raise exc
    except JWTError:
        raise exc

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise exc
    return user


class _BreakGlassPrincipal:
    """Synthetic admin principal used only for audited emergency access."""
    id = -1
    email = settings.BREAK_GLASS_EMAIL
    role = roles.ADMIN
    is_active = True
    is_break_glass = True


def _try_break_glass(request: Request, db: Session) -> Optional["_BreakGlassPrincipal"]:
    token = request.headers.get("X-Break-Glass-Token")
    if not token:
        return None
    if not (settings.BREAK_GLASS_ENABLED and settings.BREAK_GLASS_TOKEN
            and len(settings.BREAK_GLASS_TOKEN) >= 32):
        record(db, actor="unknown", action="break_glass_attempt",
               ip=client_ip(request), outcome="denied",
               detail="break-glass presented but feature disabled")
        return None
    if constant_time_compare(token, settings.BREAK_GLASS_TOKEN):
        record(db, actor=settings.BREAK_GLASS_EMAIL, actor_role=roles.ADMIN,
               action="break_glass_access", ip=client_ip(request),
               target=request.url.path, outcome="success",
               detail="emergency admin access granted via break-glass token")
        return _BreakGlassPrincipal()
    record(db, actor="unknown", action="break_glass_attempt",
           ip=client_ip(request), outcome="denied",
           detail="invalid break-glass token")
    return None


def require_role(minimum: str):
    """Dependency factory: require at least `minimum` role (or valid break-glass)."""

    def _guard(request: Request, db: Session = Depends(get_db)):
        bg = _try_break_glass(request, db)
        if bg is not None:
            return bg
        user = get_current_user(request, db)
        if not roles.at_least(user.role, minimum):
            record(db, actor=user.email, actor_role=user.role,
                   action="authz_denied", ip=client_ip(request),
                   target=request.url.path, outcome="denied",
                   detail=f"requires >= {minimum}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum}' role or higher",
            )
        return user

    return _guard


require_admin = require_role(roles.ADMIN)
require_operator = require_role(roles.OPERATOR)


def require_permission(permission: str):
    """Dependency factory: require a specific IAM permission (or valid break-glass).

    Authorization is by *permission*, resolved from the principal's role via the
    policy matrix in app.core.permissions — never a hard-coded role string.
    """

    def _guard(request: Request, db: Session = Depends(get_db)):
        bg = _try_break_glass(request, db)
        if bg is not None:
            return bg
        user = get_current_user(request, db)
        if not perms.has_permission(user.role, permission):
            record(db, actor=user.email, actor_role=user.role,
                   action="authz_denied", ip=client_ip(request),
                   target=request.url.path, outcome="denied",
                   detail=f"missing permission {permission}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission}",
            )
        return user

    return _guard
