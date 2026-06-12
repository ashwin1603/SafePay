# Go-Live Checklist (Real Money)

SafePay ships in `simulated` payment mode. **Do not process real payments until
every item below is complete.** Real-money handling carries legal, financial and
regulatory obligations.

## 1. Compliance
- [ ] Determine PCI-DSS scope. Using tokenization (Stripe.js / hosted fields)
      keeps you in **SAQ-A**. Never accept raw PAN/CVV on your servers.
- [ ] Complete and file the appropriate **SAQ**.
- [ ] Publish privacy policy & terms; confirm data-retention rules (GDPR/CCPA as
      applicable).

## 2. Secrets & configuration
- [ ] Rotate `JWT_SECRET_KEY` (the previously committed one is burned).
- [ ] Store all secrets in a managed secret store (not `.env` on disk).
- [ ] Set `ENVIRONMENT=production` (disables `/docs`, enables HSTS).
- [ ] Use a **live** Stripe key only after setting `ALLOW_LIVE_PAYMENTS=true`.
- [ ] Configure and verify Stripe **webhook signatures**.

## 3. Infrastructure
- [ ] TLS everywhere; HSTS preload; redirect HTTP→HTTPS at the edge.
- [ ] Move database to PostgreSQL with backups + encryption at rest.
- [ ] Move rate-limiting / lockout / token denylist to Redis (multi-instance).
- [ ] WAF + DDoS protection in front of the API.

## 4. Identity
- [ ] Enforce **MFA** for admin/operator accounts.
- [ ] Review and minimize who holds the break-glass token.

## 5. Assurance
- [ ] Pass CI: pytest, Bandit, pip-audit, npm audit, gitleaks, CodeQL.
- [ ] Independent **penetration test**; remediate findings.
- [ ] Load test; confirm rate limits and fraud thresholds under traffic.
- [ ] Incident-response + on-call runbook in place.

Only when all boxes are checked should you flip `PAYMENT_PROVIDER=stripe` with a
live key and `ALLOW_LIVE_PAYMENTS=true`.
