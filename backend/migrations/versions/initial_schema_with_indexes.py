"""initial hardened schema with indexes

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("failed_login_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("description", sa.String(500), server_default=""),
        sa.Column("status", sa.String(20), nullable=False, server_default="PROCESSING"),
        sa.Column("risk_score", sa.Float, server_default="0"),
        sa.Column("idempotency_key", sa.String(128), nullable=False, unique=True),
        sa.Column("provider_ref", sa.String(128), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_transactions_user_status", "transactions", ["user_id", "status"])
    op.create_index("ix_transactions_user_created", "transactions", ["user_id", "created_at"])
    op.create_index("ix_transactions_status_created", "transactions", ["status", "created_at"])

    op.create_table(
        "fraud_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("txn_id", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("risk_score", sa.Float, nullable=False),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(500), server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_logs_decision_created", "fraud_logs", ["decision", "created_at"])
    op.create_index("ix_fraud_logs_risk_score", "fraud_logs", ["risk_score"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("actor", sa.String(255), nullable=False),
        sa.Column("actor_role", sa.String(20), nullable=False, server_default=""),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target", sa.String(255), nullable=False, server_default=""),
        sa.Column("ip", sa.String(64), nullable=False, server_default=""),
        sa.Column("detail", sa.String(1000), nullable=False, server_default=""),
        sa.Column("outcome", sa.String(16), nullable=False, server_default="success"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.func.now()),
    )
    op.create_index("ix_audit_action_created", "audit_logs", ["action", "created_at"])
    op.create_index("ix_audit_logs_actor", "audit_logs", ["actor"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("fraud_logs")
    op.drop_table("transactions")
    op.drop_table("users")
