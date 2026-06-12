from pydantic import BaseModel, EmailStr, field_validator

from app.core.security import validate_password_policy


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    # NOTE: role is intentionally NOT accepted here. Self-service registration
    # always creates a plain "user". Elevating a user to operator/admin is an
    # admin-only action (see /admin/users/{id}/role) and is audited.

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        validate_password_policy(v)
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str


class UserMe(BaseModel):
    id: int
    email: str
    role: str
    permissions: list[str]
