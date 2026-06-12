"""
Seed the database with demo accounts and historical transactions.

    python seed.py

Demo credentials (development only — passwords meet the prod policy):
    admin@safepay.io     / Admin#Pass2026
    operator@safepay.io  / Operator#Pass26
    alice@corp.io        / Alice#Pass2026
"""

import random
import sys
import uuid

from app.core import roles
from app.core.security import hash_password
from app.database import SessionLocal, create_tables
from app.models.transaction import Transaction
from app.models.user import User
from app.services.fraud_service import assess_fraud, write_fraud_log

create_tables()
db = SessionLocal()

ACCOUNTS = [
    ("admin@safepay.io", "Admin#Pass2026", roles.ADMIN),
    ("operator@safepay.io", "Operator#Pass26", roles.OPERATOR),
    ("alice@corp.io", "Alice#Pass2026", roles.USER),
    ("bob@trading.co", "Bobby#Pass2026", roles.USER),
]


def run() -> None:
    if db.query(User).count() == 0:
        for email, pw, role in ACCOUNTS:
            db.add(User(email=email, password_hash=hash_password(pw), role=role))
        db.commit()
        print(f"Created {len(ACCOUNTS)} users")

    users = db.query(User).filter(User.role == roles.USER).all()
    if db.query(Transaction).count() < 30:
        random.seed(7)
        for _ in range(60):
            u = random.choice(users)
            # mix of normal + a few anomalous amounts
            amount = random.choice(
                [random.uniform(5, 400)] * 8 + [random.uniform(9000, 40000)]
            )
            res = assess_fraud(amount=amount, user_id=u.id, db=db)
            t = Transaction(user_id=u.id, amount=round(amount, 2),
                            description="seed txn", status=res.decision,
                            risk_score=res.risk_score,
                            idempotency_key=f"seed-{uuid.uuid4().hex}")
            db.add(t)
            db.flush()
            write_fraud_log(txn_id=t.id, result=res, db=db)
        db.commit()
        print("Seeded transactions:", db.query(Transaction).count())
    print("Done.")


if __name__ == "__main__":
    try:
        run()
    finally:
        db.close()
