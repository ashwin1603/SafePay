"""
SafePay Assistant — a fully offline, rule-based support assistant.

No external LLM API, no network calls, no data leaves the server. It classifies
the user's message by intent and answers from a curated knowledge base, and can
look up the authenticated user's own transaction status on request.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.transaction import Transaction


@dataclass
class ChatReply:
    reply: str
    intent: str
    suggestions: List[str] = field(default_factory=list)


_KB = {
    "greeting": (
        "Hi! I'm the SafePay Assistant. I can explain transaction statuses, "
        "walk you through making a payment, or answer security questions. "
        "What do you need?"
    ),
    "fraud": (
        "SafePay scores every transaction in real time with an IsolationForest "
        "anomaly-detection model. Based on the risk score a payment is COMPLETED "
        "(low risk), FLAGGED (needs review), or BLOCKED (high risk). Signals "
        "include amount anomalies vs. your history, transaction velocity, and "
        "unusual timing."
    ),
    "status_meaning": (
        "Transaction statuses: COMPLETED = approved and captured. "
        "FLAGGED = went through but held for manual review. "
        "BLOCKED = stopped by fraud detection (no charge). "
        "DECLINED = the processor rejected the card. "
        "PROCESSING = still in flight."
    ),
    "how_to_pay": (
        "To make a payment: open Process Payment, enter the amount and a short "
        "description, then submit. Your card is tokenized by the processor — "
        "SafePay never sees or stores the raw card number."
    ),
    "security": (
        "SafePay protects you with bcrypt-hashed passwords, short-lived JWT "
        "access tokens with refresh, account lockout after repeated failed "
        "logins, strict rate limiting, security headers (CSP/HSTS), an "
        "append-only audit log, and tokenized payments so card data never "
        "touches our servers."
    ),
    "refund": (
        "Refunds are issued to the original payment method. An operator can "
        "process one from the transaction detail view. Refunds on FLAGGED items "
        "are released only after review clears them."
    ),
    "fallback": (
        "I'm not sure about that one. I can help with: making a payment, what a "
        "transaction status means, fraud detection, refunds, or account security."
    ),
}

_PATTERNS = [
    ("greeting",       r"\b(hi|hello|hey|good (morning|afternoon|evening))\b"),
    ("status_lookup",  r"\b(status|where).*(my|last|recent).*(payment|transaction|txn)\b"),
    ("status_lookup",  r"\btxn[-\s]?\d+\b"),
    ("status_meaning", r"\b(what does|meaning|mean).*(flagged|blocked|completed|declined|status)\b"),
    ("status_meaning", r"\b(flagged|blocked|declined)\b"),
    ("fraud",          r"\b(fraud|risk|anomaly|suspicious|scam)\b"),
    ("how_to_pay",     r"\b(how (do|to)|make|send|process).*(pay|payment|money)\b"),
    ("refund",         r"\b(refund|chargeback|money back)\b"),
    ("security",       r"\b(secure|security|safe|protect|password|hack|breach|privacy)\b"),
]


def _lookup_status(message: str, db: Optional[Session], user_id: Optional[int]) -> Optional[str]:
    if db is None or user_id is None:
        return ("Sign in and I can look up your transactions. " )
    m = re.search(r"txn[-\s]?(\d+)", message, re.I)
    if m:
        txn = (db.query(Transaction)
               .filter(Transaction.id == int(m.group(1)),
                       Transaction.user_id == user_id).first())
        if not txn:
            return "I couldn't find that transaction on your account."
        return (f"TXN-{txn.id:05d}: {txn.status} (risk {txn.risk_score:.2f}, "
                f"amount {txn.amount:.2f}).")
    last = (db.query(Transaction).filter(Transaction.user_id == user_id)
            .order_by(Transaction.created_at.desc()).first())
    if not last:
        return "You don't have any transactions yet."
    return (f"Your most recent payment TXN-{last.id:05d} is {last.status} "
            f"(risk {last.risk_score:.2f}, amount {last.amount:.2f}).")


def answer(message: str, db: Optional[Session] = None,
           user_id: Optional[int] = None) -> ChatReply:
    text = (message or "").strip().lower()
    if not text:
        return ChatReply(_KB["fallback"], "fallback")

    intent = "fallback"
    for name, pat in _PATTERNS:
        if re.search(pat, text):
            intent = name
            break

    if intent == "status_lookup":
        body = _lookup_status(message, db, user_id)
        return ChatReply(body, "status_lookup",
                         ["What does FLAGGED mean?", "How is fraud detected?"])

    reply = _KB.get(intent, _KB["fallback"])
    suggestions = {
        "greeting": ["How do I make a payment?", "Is SafePay secure?"],
        "fraud": ["What does BLOCKED mean?", "How do I appeal a block?"],
        "how_to_pay": ["Is my card data safe?", "What are the limits?"],
        "security": ["How are passwords stored?", "What is the audit log?"],
    }.get(intent, ["How do I make a payment?", "What does FLAGGED mean?"])
    return ChatReply(reply, intent, suggestions)
