from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import JSON

from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(
        String(20), default="PROCESSING", nullable=False
    )  # PROCESSING | COMPLETED | FLAGGED | BLOCKED | DECLINED | REFUNDED
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    idempotency_key: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )
    provider_ref: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Explainable fraud (Feature 1) ─────────────────────────────────────────
    fraud_explanation: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # ── Appeal flow (Feature 1) ───────────────────────────────────────────────
    appeal_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # pending | approved | rejected
    appeal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    appeal_reviewed_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    appeal_reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Chargeback prediction (Feature 7) ─────────────────────────────────────
    chargeback_risk: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

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