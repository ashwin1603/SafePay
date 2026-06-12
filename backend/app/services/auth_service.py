"""Authentication: registration, login (with lockout) and token refresh."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core import roles
from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    hash_password, verify_password,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.audit_service import record


def _tokens(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user.id), user.role),
        refresh_token=create_refresh_token(str(user.id), user.role),
        user_id=user.id, role=user.role,
    )


def register_user(payload: RegisterRequest, db: Session, ip: str = "") -> TokenResponse:
    if db.query(User).filter(User.email == payload.email).first():
        # Avoid user-enumeration: generic 409.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Could not register with those details")
    user = User(email=payload.email,
                password_hash=hash_password(payload.password),
                role=roles.USER)
    db.add(user)
    db.commit()
    db.refresh(user)
    record(db, actor=user.email, actor_role=user.role, action="register",
           ip=ip, target=str(user.id))
    return _tokens(user)


def login_user(payload: LoginRequest, db: Session, ip: str = "") -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    now = datetime.now(timezone.utc)

    # Account lockout check (coerce naive DB datetimes to UTC)
    locked_until = user.locked_until if user else None
    if locked_until is not None and locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    if user and locked_until and locked_until > now:
        record(db, actor=payload.email, action="login", ip=ip, outcome="locked")
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Account temporarily locked. Try again later.")

    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= settings.MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(minutes=settings.LOCKOUT_MINUTES)
                user.failed_login_count = 0
                record(db, actor=payload.email, action="account_locked", ip=ip,
                       outcome="locked", detail="too many failed logins", commit=False)
            db.commit()
        record(db, actor=payload.email, action="login", ip=ip, outcome="failure")
        # Generic message — never reveal whether email exists.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password")

    # Success — reset counters
    user.failed_login_count = 0
    user.locked_until = None
    db.commit()
    record(db, actor=user.email, actor_role=user.role, action="login", ip=ip,
           outcome="success")
    return _tokens(user)


def refresh_tokens(refresh_token: str, db: Session, ip: str = "") -> TokenResponse:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid refresh token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid refresh token")
    record(db, actor=user.email, actor_role=user.role, action="token_refresh", ip=ip)
    return _tokens(user)
