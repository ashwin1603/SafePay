# SafePay — Secure Payment Gateway

SafePay is a full-stack payment gateway built security-first: JWT authentication with refresh tokens, permission-based access control (IAM), AI-driven fraud detection, tokenized payments (raw card data never touches the server), an append-only audit log, and an offline support assistant.

- **Backend:** FastAPI · SQLAlchemy · Alembic · scikit-learn (IsolationForest)
- **Frontend:** React 19 · Vite · Tailwind · Recharts
- **Payments:** simulated processor by default; Stripe PaymentIntents (test mode) optional

> ⚠️ **Payments run in `simulated` mode by default — no real money moves.**
> Processing real money requires completing [`docs/GO_LIVE_CHECKLIST.md`](docs/GO_LIVE_CHECKLIST.md)
> (PCI SAQ-A, HTTPS/HSTS, secret rotation, penetration test). See [SECURITY.md](SECURITY.md).

## Features

- **Authentication** — bcrypt password hashing, password policy, short-lived JWT access tokens (15 min) + refresh tokens, account lockout after repeated failed logins.
- **IAM / RBAC** — permission-based authorization with a `user` < `operator` < `admin` role matrix. Every endpoint is guarded by a named permission, and the UI hides what your role can't use. See [`docs/IAM.md`](docs/IAM.md).
- **Explainable Fraud Decisions (Glass-Box)** — per-signal impact breakdown (high, medium, low) and plain-language summaries explaining why any transaction was flagged or blocked.
- **Rules Engine & Backtesting** — operator-authored boolean policy rules executed alongside the AI engine, with a sandbox console to test rules against historical transaction logs.
- **Risk-Adaptive Step-Up 2FA** — payments yielding borderline-suspicious fraud scores trigger a verification SMS code challenge flow before finalization.
- **Bloom Filter Consortium Network** — privacy-preserving shared blacklist network to sync cryptographically hashed risk signals across institutions using base64 Bloom filter merges.
- **Model Observability Telemetry** — real-time monitoring of average scores, verdict distributions, high-firing alert indicators, and Kolmogorov-Smirnov drift analytics.
- **Attack Simulation Sandbox** — sandbox triggering synthetic threat scenarios (card testing, velocity bursts, account takeover, high-value fraud) to test model thresholds.
- **Pre-Settlement Dispute Prevention** — scanner using multi-factorial analysis (e.g. z-score, age, time risk) to predict chargeback probability prior to settlement.
- **Audit log** — append-only record of logins, lockouts, role changes, payments, refunds, and emergency access.
- **Offline assistant** — a rule-based support chatbot with no external API calls; nothing leaves the server.
- **Hardening** — security headers (CSP/HSTS), trusted-host check, explicit CORS allow-list, request size cap, and rate limiting.

## Quick start

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(48))" >> .env
python seed.py             # demo users + sample transactions
uvicorn main:app --reload  # API + docs at http://localhost:8000/docs
```

### Frontend
```bash
npm install
npm run dev                # http://localhost:5173
```

### Demo logins (development only)

| Role     | Email                | Password          | Can do                                            |
|----------|----------------------|-------------------|---------------------------------------------------|
| admin    | admin@safepay.io     | `Admin#Pass2026`  | everything, incl. users, roles, audit log         |
| operator | operator@safepay.io  | `Operator#Pass26` | review/refund txns, all txns, stats, retrain model |
| user     | alice@corp.io        | `Alice#Pass2026`  | make payments, view own transactions              |

## Tests
```bash
cd backend && pytest -q
```

## Architecture

```
React SPA ──HTTPS──> FastAPI
                       ├─ middleware: TrustedHost · SecurityHeaders · RateLimit · CORS
                       ├─ /auth              register / login (lockout) / refresh / me
                       ├─ /process-payment   fraud scoring → tokenized charge & step-up verification
                       ├─ /transactions      own rows (operator/admin: all, review, refund)
                       ├─ /appeals           submit and review transaction verdicts
                       ├─ /fraud-rules       manage rules and run backtest simulations
                       ├─ /consortium        sync bloom filters and inspect signals
                       ├─ /analytics         KS drift and alert distribution statistics
                       ├─ /simulation        trigger simulated synthetic attack scenarios
                       ├─ /chargeback        pre-settlement scanner and predictions
                       ├─ /admin             users / stats / audit / retrain / role
                       └─ /chat              offline rule-based assistant
                       ▼
              SQLite (dev) / PostgreSQL (prod)
              users · transactions · fraud_logs · fraud_rules · audit_logs
```

Authorization is permission-based: each route requires a named permission (e.g. `payment:create`, `transaction:refund`, `user:set_role`), resolved from the principal's role via the policy matrix in `backend/app/core/permissions.py`. The frontend gates navigation, routes, and buttons off the permission list returned by `GET /auth/me`.

Card data flow (PCI SAQ-A): the browser tokenizes the card directly with the processor; SafePay only ever receives an opaque token. No PAN/CVV is logged or stored.

## Documentation

- [SECURITY.md](SECURITY.md) — security controls and vulnerability reporting
- [docs/IAM.md](docs/IAM.md) — roles, permissions, and policy matrix
- [THREAT_MODEL.md](THREAT_MODEL.md) — STRIDE threat analysis
- [docs/BREAK_GLASS.md](docs/BREAK_GLASS.md) — audited emergency-access runbook
- [docs/GO_LIVE_CHECKLIST.md](docs/GO_LIVE_CHECKLIST.md) — requirements before processing real money

## Tech stack

| Layer    | Technologies                                              |
|----------|-----------------------------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS, React Router, Recharts      |
| Backend  | FastAPI, SQLAlchemy, Alembic, Pydantic                    |
| Auth     | python-jose (JWT), passlib + bcrypt                       |
| Fraud AI | scikit-learn (IsolationForest), NumPy                     |
| Payments | Simulated processor (default) / Stripe PaymentIntents     |
| CI       | GitHub Actions: pytest, Bandit, pip-audit, npm audit, gitleaks, CodeQL |
