from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(
        String(20), default="PROCESSING", nullable=False
    )  # PROCESSING | COMPLETED | FLAGGED | BLOCKED
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    idempotency_key: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    provider_ref: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Composite indexes for common query patterns ───────────────────────────
    # Used by: GET /transactions?status=FLAGGED (user's own filtered list)
    __table_args__ = (
        Index("ix_transactions_user_status", "user_id", "status"),
        # Used by: time-range queries, dashboard charts, fraud velocity checks
        Index("ix_transactions_user_created", "user_id", "created_at"),
        # Used by: admin stats — counting by status across all users
        Index("ix_transactions_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} status={self.status} amount={self.amount}>"