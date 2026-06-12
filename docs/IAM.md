# IAM — Roles, Permissions & Policy

Authorization in SafePay is **permission-based**, not role-based-in-code. Every
endpoint is guarded by a named permission (e.g. `user:delete`); roles are just
named bundles of permissions. The single source of truth is
`backend/app/core/permissions.py`. The frontend gates nav, routes and buttons
off the exact permission list the server returns from `GET /auth/me`.

## Roles

| Role | Who | Intent |
|------|-----|--------|
| `user` | account holder | transact and view only their own activity |
| `operator` | risk / operations staff | review, refund, see all transactions, retrain the model — **no identity powers** |
| `admin` | administrator | everything operator can do **plus** IAM (users, roles) and the audit trail |

## Permission matrix

| Permission | user | operator | admin |
|------------|:----:|:--------:|:-----:|
| `payment:create` | ✓ | ✓ | ✓ |
| `transaction:read:own` | ✓ | ✓ | ✓ |
| `transaction:read:all` |  | ✓ | ✓ |
| `transaction:review` |  | ✓ | ✓ |
| `transaction:refund` |  | ✓ | ✓ |
| `stats:read` |  | ✓ | ✓ |
| `model:retrain` |  | ✓ | ✓ |
| `audit:read` |  |  | ✓ |
| `user:read` |  |  | ✓ |
| `user:set_role` |  |  | ✓ |
| `user:delete` |  |  | ✓ |

Verified live (HTTP status by role):

| Endpoint | user | operator | admin |
|----------|:----:|:--------:|:-----:|
| `GET /admin/stats` | 403 | 200 | 200 |
| `POST /admin/retrain` | 403 | 200 | 200 |
| `GET /admin/users` | 403 | 403 | 200 |
| `GET /admin/audit` | 403 | 403 | 200 |

## Enforcement

- **Server (authoritative):** `require_permission("...")` on every route. A
  denied request is written to the audit log. Break-glass principals carry the
  admin role and inherit admin permissions, fully audited.
- **Client (UX only):** `useAuth().can("permission")` hides nav items, guards
  routes (`<Guard perm=...>` → renders an access-denied page), and conditionally
  renders privileged buttons. This never replaces server checks — it just avoids
  showing controls a user can't use.

## Changing the policy

Edit the matrix in `permissions.py` only. No route code changes needed — adding
a permission to a role instantly grants it everywhere that permission is checked,
and `/auth/me` reflects it so the UI updates too.
