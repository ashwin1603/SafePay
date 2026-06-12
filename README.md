# SafePay — Secure Payment Gateway

SafePay is a full-stack payment gateway built for security first: JWT auth with
refresh tokens, role-based access control, AI-based fraud detection, tokenized
payments (card data never touches the server), an append-only audit log, and an
offline assistant chatbot.

- **Backend:** FastAPI · SQLAlchemy · Alembic · scikit-learn (IsolationForest)
- **Frontend:** React 19 · Vite · Tailwind · Recharts
- **Payments:** simulated processor by default; Stripe PaymentIntents (test mode) optional

> ⚠️ **Payments are in `simulated` mode by default — no real money moves.**
> Moving real money requires completing [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md)
> (PCI SAQ-A, HTTPS/HSTS, secret rotation, pen test). See [SECURITY.md](SECURITY.md).

## Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(48))" >> .env
python seed.py            # demo users + sample transactions
uvicorn main:app --reload # http://localhost:8000/docs
```

### Frontend
```bash
npm install
npm run dev               # http://localhost:5173
```

### Demo logins (development only)
| Role     | Email                | Password          |
|----------|----------------------|-------------------|
| admin    | admin@safepay.io     | `Admin#Pass2026`  |
| operator | operator@safepay.io  | `Operator#Pass26` |
| user     | alice@corp.io        | `Alice#Pass2026`  |

## Tests
```bash
cd backend && pytest -q
```

## Architecture

```
React SPA ──HTTPS──> FastAPI
                       ├─ middleware: TrustedHost · SecurityHeaders · RateLimit · CORS
                       ├─ /auth        register / login (lockout) / refresh / me
                       ├─ /process-payment   fraud scoring → tokenized charge
                       ├─ /transactions      own rows (admins: all)
                       ├─ /admin             users / stats / audit / retrain / role
                       └─ /chat              offline rule-based assistant
                       ▼
              SQLite (dev) / PostgreSQL (prod)
              users · transactions · fraud_logs · audit_logs
```

Card data flow (PCI SAQ-A): the browser tokenizes the card directly with the
processor; SafePay only ever receives an opaque token. No PAN/CVV is logged or
stored.

See [SECURITY.md](SECURITY.md), [docs/IAM.md](docs/IAM.md), [THREAT_MODEL.md](THREAT_MODEL.md), and
[docs/BREAK_GLASS.md](docs/BREAK_GLASS.md).
