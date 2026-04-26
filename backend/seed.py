"""
Seed Script - SafePay Flow
--------------------------
Run once to populate the DB with:
  - 1 admin user     (admin@safepay.io / Admin@1234)
  - 5 regular users
  - ~80 historical transactions across varying risk levels

Usage (from backend/):
    python seed.py
"""

import random
import string
import sys
import os

# Force UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Ensure the backend package root is on path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.fraud_log import FraudLog
from app.models.transaction import Transaction
from app.models.user import User
from app.services.fraud_service import assess_fraud

create_tables()

ADMIN_EMAIL = "admin@safepay.io"
ADMIN_PASS = "Admin@1234"

SEED_USERS = [
    ("alice@corp.io", "Pass@1234"),
    ("bob@trading.co", "Pass@1234"),
    ("carol@finco.in", "Pass@1234"),
    ("dave@payments.us", "Pass@1234"),
    ("eve@bankx.com", "Pass@1234"),
]

# Transaction profiles: (weight, amount_range, description)
TXN_PROFILES = [
    (60, (10, 2_000), "Invoice payment"),
    (20, (2_000, 8_000), "Wire transfer"),
    (10, (8_000, 50_000), "Large corporate payment"),
    (5, (0.01, 5), "Micro-test transaction"),
    (5, (30_000, 100_000), "Suspicious large transfer"),
]


def _random_key(n: int = 24) -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=n))


def _weighted_amount() -> float:
    weights = [p[0] for p in TXN_PROFILES]
    profile = random.choices(TXN_PROFILES, weights=weights, k=1)[0]
    lo, hi = profile[1]
    return round(random.uniform(lo, hi), 2)


def seed():
    db = SessionLocal()
    try:
        # ── Admin ──────────────────────────────────────────────────────────────
        admin = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not admin:
            admin = User(
                email=ADMIN_EMAIL,
                password_hash=hash_password(ADMIN_PASS),
                role="admin",
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"  [+] Admin created  -> {ADMIN_EMAIL} / {ADMIN_PASS}")
        else:
            print(f"  [=] Admin exists   -> {ADMIN_EMAIL}")

        # ── Regular users ──────────────────────────────────────────────────────
        user_ids: list[int] = []
        for email, pwd in SEED_USERS:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(email=email, password_hash=hash_password(pwd), role="user")
                db.add(u)
                db.commit()
                db.refresh(u)
                print(f"  [+] User created   -> {email}")
            else:
                print(f"  [=] User exists    -> {email}")
            user_ids.append(u.id)

        # ── Transactions ───────────────────────────────────────────────────────
        existing_count = db.query(Transaction).count()
        if existing_count >= 80:
            print(f"  [=] {existing_count} transactions already seeded - skipping")
            return

        created = 0
        for _ in range(90):
            user_id = random.choice(user_ids)
            amount = _weighted_amount()
            key = _random_key()

            # Ensure unique idempotency key
            while db.query(Transaction).filter(Transaction.idempotency_key == key).first():
                key = _random_key()

            txn = Transaction(
                user_id=user_id,
                amount=amount,
                description=random.choice([p[2] for p in TXN_PROFILES]),
                status="PROCESSING",
                risk_score=0.0,
                idempotency_key=key,
            )
            db.add(txn)
            db.flush()

            result = assess_fraud(amount=amount, user_id=user_id, db=db)
            txn.status = result.decision
            txn.risk_score = result.risk_score

            log = FraudLog(
                txn_id=txn.id,
                risk_score=result.risk_score,
                decision=result.decision,
                reason=result.reason,
            )
            db.add(log)
            db.commit()
            created += 1

        print(f"  [+] {created} transactions seeded")

    finally:
        db.close()


if __name__ == "__main__":
    print("\nSafePayFlow Seeder")
    print("=" * 40)
    seed()
    print("\nDone! Start the server with:")
    print("  uvicorn main:app --reload --port 8000\n")
