from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    """
    Append-only audit trail. Every security-relevant event is recorded here:
    logins (success/failure), lockouts, admin actions, break-glass use,
    payment decisions. Never updated or deleted in normal operation.
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(255), nullable=False, index=True)  # email / user_id / "break-glass"
    actor_role: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    ip: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    detail: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    outcome: Mapped[str] = mapped_column(String(16), default="success", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("ix_audit_action_created", "action", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog actor={self.actor} action={self.action} outcome={self.outcome}>"
