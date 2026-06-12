"""
Database engine and session factory.

- SQLite   (dev)  : DATABASE_URL = sqlite:///./safepay.db
- PostgreSQL (prod): DATABASE_URL = postgresql+psycopg2://user:pass@host:5432/safepay

The engine is configured appropriately for each dialect automatically.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings


def _build_engine():
    url = settings.DATABASE_URL
    is_sqlite = url.startswith("sqlite")

    if is_sqlite:
        engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
        )
        # Enable WAL mode for SQLite — dramatically reduces write contention
        # when multiple requests hit the DB simultaneously (dev scenario).
        @event.listens_for(engine, "connect")
        def set_sqlite_pragmas(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    else:
        # PostgreSQL — use connection pooling suited for a web server
        engine = create_engine(
            url,
            pool_size=10,          # keep 10 connections warm
            max_overflow=20,       # allow burst up to 30 total
            pool_pre_ping=True,    # test connections before use (handles DB restarts)
            echo=False,
        )
        return engine


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables() -> None:
    """Create all tables that don't exist yet (idempotent, call on startup)."""
    from app.models import user, transaction, fraud_log, audit_log  # noqa: F401
    Base.metadata.create_all(bind=engine)