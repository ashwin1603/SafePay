"""
IAM permission catalog and role -> permission policy matrix.

This is the single source of truth for "who can do what". Endpoints are guarded
by a *permission* (e.g. `user:delete`), never by a hard-coded role check, so the
policy can evolve without touching route code. Mirrors how real gateways model
authorization (account holders vs. operations/risk staff vs. administrators).
"""

from __future__ import annotations

from app.core import roles

# ── Permission catalog ────────────────────────────────────────────────────────
PAYMENT_CREATE       = "payment:create"
TXN_READ_OWN         = "transaction:read:own"
TXN_READ_ALL         = "transaction:read:all"
TXN_REVIEW           = "transaction:review"     # approve / reject a FLAGGED txn
TXN_REFUND           = "transaction:refund"
STATS_READ           = "stats:read"
AUDIT_READ           = "audit:read"
MODEL_RETRAIN        = "model:retrain"
USER_READ            = "user:read"
USER_SET_ROLE        = "user:set_role"
USER_DELETE          = "user:delete"

# ── New permissions (7-feature expansion) ─────────────────────────────────────
APPEAL_SUBMIT        = "appeal:submit"          # users appeal their own blocked/flagged txn
APPEAL_REVIEW        = "appeal:review"          # operators review appeals
FRAUD_RULES_MANAGE   = "fraud_rules:manage"     # CRUD fraud rules
FRAUD_RULES_TEST     = "fraud_rules:test"       # backtest rules
ANALYTICS_VIEW       = "analytics:view"         # real-time analytics dashboard
SIMULATION_RUN       = "simulation:run"         # run attack simulations
CONSORTIUM_MANAGE    = "consortium:manage"       # manage shared fraud signals
CHARGEBACK_VIEW      = "chargeback:view"        # view chargeback predictions

ALL_PERMISSIONS = {
    PAYMENT_CREATE, TXN_READ_OWN, TXN_READ_ALL, TXN_REVIEW, TXN_REFUND,
    STATS_READ, AUDIT_READ, MODEL_RETRAIN, USER_READ, USER_SET_ROLE, USER_DELETE,
    APPEAL_SUBMIT, APPEAL_REVIEW, FRAUD_RULES_MANAGE, FRAUD_RULES_TEST,
    ANALYTICS_VIEW, SIMULATION_RUN, CONSORTIUM_MANAGE, CHARGEBACK_VIEW,
}

# ── Role -> permission matrix ─────────────────────────────────────────────────
# user     : an account holder. Can transact and see only their own activity.
# operator : risk / operations staff. Reviews and refunds, sees all transactions
#            and stats, retrains the model — but NO identity/IAM powers.
# admin    : full administrator. Everything the operator can do, plus IAM
#            (read users, change roles, delete users) and the audit trail.
_USER_PERMS = {PAYMENT_CREATE, TXN_READ_OWN, APPEAL_SUBMIT}

_OPERATOR_PERMS = _USER_PERMS | {
    TXN_READ_ALL, TXN_REVIEW, TXN_REFUND, STATS_READ, MODEL_RETRAIN,
    APPEAL_REVIEW, FRAUD_RULES_MANAGE, FRAUD_RULES_TEST,
    ANALYTICS_VIEW, SIMULATION_RUN, CHARGEBACK_VIEW,
}

_ADMIN_PERMS = _OPERATOR_PERMS | {
    AUDIT_READ, USER_READ, USER_SET_ROLE, USER_DELETE, CONSORTIUM_MANAGE,
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    roles.USER: _USER_PERMS,
    roles.OPERATOR: _OPERATOR_PERMS,
    roles.ADMIN: _ADMIN_PERMS,
}


def permissions_for(role: str) -> set[str]:
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: str, permission: str) -> bool:
    # Break-glass principals carry role=admin, so they inherit admin perms.
    return permission in ROLE_PERMISSIONS.get(role, set())
