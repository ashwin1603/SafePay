from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FraudLog(Base):
    __tablename__ = "fraud_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    txn_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transactions.id"), nullable=False, index=True
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    decision: Mapped[str] = mapped_column(String(20), nullable=False)   # COMPLETED | FLAGGED | BLOCKED
    reason: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<FraudLog txn_id={self.txn_id} decision={self.decision} score={self.risk_score:.2f}>"
