"""add feature columns and fraud rules table

Revision ID: 0002_add_features
Revises: 0001_initial
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = "0002_add_features"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create fraud_rules table
    op.create_table(
        "fraud_rules",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(500), nullable=False, server_default=""),
        sa.Column("conditions", sa.Text, nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.String(255), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_fraud_rules_id", "fraud_rules", ["id"])

    # 2. Add columns to transactions table
    # SQLite does not support adding multiple columns in a single statement,
    # so we execute them one by one. JSON type handles the mapping properly.
    op.add_column("transactions", sa.Column("fraud_explanation", sa.JSON(), nullable=True))
    op.add_column("transactions", sa.Column("appeal_status", sa.String(20), nullable=True))
    op.add_column("transactions", sa.Column("appeal_reason", sa.String(1000), nullable=True))
    op.add_column("transactions", sa.Column("appeal_reviewed_by", sa.String(255), nullable=True))
    op.add_column("transactions", sa.Column("appeal_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("chargeback_risk", sa.Float(), nullable=True))


def downgrade() -> None:
    # Drop columns from transactions
    # Note: SQLite has limitations dropping columns in older versions, but Alembic can try/support it.
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("chargeback_risk")
        batch_op.drop_column("appeal_reviewed_at")
        batch_op.drop_column("appeal_reviewed_by")
        batch_op.drop_column("appeal_reason")
        batch_op.drop_column("appeal_status")
        batch_op.drop_column("fraud_explanation")

    op.drop_index("ix_fraud_rules_id", table_name="fraud_rules")
    op.drop_table("fraud_rules")
