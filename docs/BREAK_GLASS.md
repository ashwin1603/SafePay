# Break-Glass Emergency Access (Runbook)

Break-glass is SafePay's **legitimate, audited** alternative to a hidden
backdoor. It lets an authorized operator reach admin endpoints during an
emergency (e.g. to deploy a security patch or freeze fraud) when normal accounts
are unavailable — without weakening any other control.

## Properties
- **Off by default.** Requires `BREAK_GLASS_ENABLED=true` AND a `BREAK_GLASS_TOKEN`
  of ≥32 random characters set in the environment / secret manager.
- **Strongly authenticated.** Presented via the `X-Break-Glass-Token` header and
  compared in constant time.
- **Fully audited.** Every attempt (success, denied, invalid) is written to the
  `audit_logs` table and mirrored to the application log.
- **Least privilege in time.** Intended for short, deliberate use; rotate the
  token immediately after.

## Enabling (only when needed)
```bash
# In your secret manager / CI secrets — NOT in git:
export BREAK_GLASS_ENABLED=true
export BREAK_GLASS_TOKEN="$(python -c 'import secrets;print(secrets.token_urlsafe(40))')"
# restart the service so settings reload
```

## Using it
```bash
curl https://api.safepay.example/admin/stats \
  -H "X-Break-Glass-Token: <token>"
```

## After the emergency (mandatory)
1. Review the audit log entries for `break_glass_access`.
2. Rotate the token (or set `BREAK_GLASS_ENABLED=false`).
3. File an incident note describing what was done and why.

## What we deliberately did NOT build
A hidden/undocumented bypass, a default-credential, or any "secret" path. Those
are indistinguishable from an attacker's backdoor, fail every audit, and violate
PCI-DSS. Break-glass achieves the same goal safely and transparently.
