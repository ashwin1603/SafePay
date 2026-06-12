"""Helper to write audit-log entries from anywhere in the app."""

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

logger = logging.getLogger("safepay.audit")


def record(
    db: Session,
    *,
    actor: str,
    action: str,
    actor_role: str = "",
    target: str = "",
    ip: str = "",
    detail: str = "",
    outcome: str = "success",
    commit: bool = True,
) -> None:
    entry = AuditLog(
        actor=actor, actor_role=actor_role, action=action, target=target,
        ip=ip, detail=detail[:1000], outcome=outcome,
    )
    db.add(entry)
    if commit:
        db.commit()
    # Mirror to application log for real-time SIEM ingestion.
    logger.info("AUDIT actor=%s action=%s target=%s outcome=%s ip=%s",
                actor, action, target, outcome, ip)
