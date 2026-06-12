# Security Overview

SafePay is built defense-in-depth. This document describes the controls in place,
how to report a vulnerability, and the deliberate design decision **not** to ship
a hidden backdoor.

## Reporting a vulnerability
Email security@safepay.local (replace with your real contact) with steps to
reproduce. Please do not open public issues for security bugs. We aim to
acknowledge within 48 hours.

## Controls implemented

### Authentication & sessions
- Passwords hashed with **bcrypt** (cost 12), constant-time verification.
- Password policy: ≥10 chars, 3 of 4 character classes, common-password blocklist.
- **JWT** access tokens are short-lived (15 min) and typed; separate refresh
  tokens (7 days). Tokens carry issuer + audience claims and a unique `jti`;
  the wrong token type is rejected.
- **Account lockout**: 5 failed logins → 15-minute lock. Generic error messages
  prevent username enumeration.

### Authorization (RBAC)
- Roles: `user` < `operator` < `admin`, enforced by a single `require_role`
  dependency.
- **Self-registration can never create privileged accounts** — the `role` field
  is ignored on `/auth/register`. Elevation is an audited admin-only action.
- Payments are **bound to the authenticated user** (no `user_id` in the request
  body), closing the IDOR where a caller could pay/act as someone else.
- Object-level checks on transaction reads (users see only their own).

### Network & transport
- `TrustedHostMiddleware` (Host-header / DNS-rebinding protection).
- Explicit CORS allow-list (no wildcard with credentials).
- Security headers on every response: `Content-Security-Policy`,
  `Strict-Transport-Security` (prod), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener/Resource-Policy`, `Cache-Control: no-store`.
- Request body size cap (1 MB) and per-client sliding-window rate limiting.

### Payments
- **Tokenization**: raw card numbers never reach SafePay (PCI SAQ-A model).
- Fraud scoring runs **before** any charge; `BLOCKED` never reaches the processor.
- **Idempotency keys** guarantee exactly-once processing; keys are not reusable
  across users.
- Live Stripe keys are refused unless `ENVIRONMENT=production` **and**
  `ALLOW_LIVE_PAYMENTS=true` — a deliberate guard rail against accidental real
  charges.

### Data & secrets
- No secrets in the repo. `.env` and `*.db` are git-ignored; `.env.example`
  documents required variables.
- `JWT_SECRET_KEY` must be ≥32 chars; the app **refuses to start in production**
  without one. (The previously committed secret has been removed — rotate it.)
- ORM (SQLAlchemy) parameterizes all queries → no SQL injection.
- Append-only **audit log** records logins, lockouts, role changes, deletions,
  payments, and break-glass use.

### Supply chain / CI
- GitHub Actions runs pytest, **Bandit** (SAST), **pip-audit** & `npm audit`
  (dependency CVEs), **gitleaks** (secret scanning) and **CodeQL** on every PR.

## Why there is no hidden backdoor — and what we do instead
A covert "hidden access" path is itself the worst vulnerability a payment system
can have: it cannot be reasoned about, it bypasses every other control, and when
discovered it becomes the breach. SafePay therefore provides a **break-glass**
mechanism instead — legitimate emergency access that is:

- **disabled by default** (off unless an operator sets a strong token),
- **strongly authenticated** (≥32-char token, constant-time comparison),
- **fully audited** (every attempt and use is written to the audit log),
- **documented and revocable** (see `docs/BREAK_GLASS.md`).

This gives the same operational outcome — getting in to patch urgently — without
the catastrophic risk of an undocumented bypass.
