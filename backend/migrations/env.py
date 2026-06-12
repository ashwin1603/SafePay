"""
Alembic environment — reads DATABASE_URL from app settings so there is
a single source of truth (the .env file / environment variables).

Supports both SQLite (dev) and PostgreSQL (production) without any changes.
"""

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# ── Make the backend package importable ──────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings   # reads .env automatically
from app.database import Base          # imports our DeclarativeBase

# Import all models so Alembic sees them for autogenerate
from app.models import user, transaction, fraud_log  # noqa: F401

# ── Alembic Config ───────────────────────────────────────────────────────────
config = context.config

# Inject the real DB URL from app settings (overrides the blank in alembic.ini)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Wire up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate support
target_metadata = Base.metadata


# ── Offline mode (generate SQL without a live connection) ────────────────────
def run_migrations_offline() -> None:
    """
    Emit migration SQL to stdout — useful for review or piping to psql.
    Run with: alembic upgrade head --sql
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online mode (apply migrations against a live DB) ─────────────────────────
def run_migrations_online() -> None:
    """
    Connect to the database and apply migrations.
    SQLite uses NullPool (no connection pooling); PostgreSQL gets the default.
    """
    db_url = config.get_main_option("sqlalchemy.url")
    is_sqlite = db_url.startswith("sqlite")

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool if is_sqlite else pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            # Render column comments in migration scripts
            render_as_batch=is_sqlite,  # required for SQLite ALTER TABLE support
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()