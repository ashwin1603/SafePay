# Threat Model (STRIDE)

Scope: SafePay API + SPA, simulated/Stripe-tokenized payments. Out of scope:
the card processor's own infrastructure, and real-money settlement (gated).

## Assets
- User credentials and sessions (JWTs).
- Transaction records and fraud decisions.
- The audit log (integrity is paramount).
- Break-glass token and JWT signing key.

## Trust boundaries
1. Browser ↔ API (untrusted client; all input validated server-side).
2. API ↔ Database.
3. API ↔ Payment processor (token-only).

## STRIDE analysis

| Category | Threat | Mitigation |
|---|---|---|
| **Spoofing** | Stolen/forged token | Signed JWT w/ iss+aud+exp+jti, type checks, short TTL, refresh rotation |
| **Spoofing** | Credential stuffing / brute force | bcrypt, lockout after 5 fails, rate limiting, generic errors |
| **Tampering** | Modifying another user's payment (IDOR) | Payer derived from token, object-level authz, server-side validation |
| **Tampering** | SQL injection | SQLAlchemy parameterized queries only |
| **Tampering** | Audit log alteration | Append-only writes; mirrored to app log for SIEM; no update/delete API |
| **Repudiation** | "I didn't do that" | Audit log with actor, action, IP, outcome, timestamp |
| **Info disclosure** | Card data leak | Tokenization — PAN/CVV never reach the server or logs |
| **Info disclosure** | Username enumeration | Generic 401/409 messages |
| **Info disclosure** | Verbose errors / docs in prod | Generic 500s; `/docs` disabled in production |
| **DoS** | Request flooding | Rate limiter + 1 MB body cap + DB indexes |
| **DoS** | DNS rebinding / Host abuse | TrustedHostMiddleware allow-list |
| **Elevation** | Self-register as admin | `role` ignored on register; elevation is admin-only + audited |
| **Elevation** | Privilege via break-glass | Disabled by default, strong token, constant-time compare, fully audited |

## Residual risks / future work
- Token revocation is time-based (short TTL) rather than a server-side blocklist;
  add a Redis denylist of `jti` for instant logout-everywhere.
- Rate limiter and lockout are in-memory (single instance); move to Redis for
  multi-instance deployments.
- Add 2FA/MFA for admin and operator accounts.
- Add webhook signature verification for Stripe events before go-live.
