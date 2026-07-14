// Mirror of the backend permission catalog (app/core/permissions.py).
// The backend is always authoritative — these names just drive UI gating.
export const P = {
  PAYMENT_CREATE: 'payment:create',
  TXN_READ_OWN: 'transaction:read:own',
  TXN_READ_ALL: 'transaction:read:all',
  TXN_REVIEW: 'transaction:review',
  TXN_REFUND: 'transaction:refund',
  STATS_READ: 'stats:read',
  AUDIT_READ: 'audit:read',
  MODEL_RETRAIN: 'model:retrain',
  USER_READ: 'user:read',
  USER_SET_ROLE: 'user:set_role',
  USER_DELETE: 'user:delete',
  
  // New features
  APPEAL_SUBMIT: 'appeal:submit',
  APPEAL_REVIEW: 'appeal:review',
  FRAUD_RULES_MANAGE: 'fraud_rules:manage',
  FRAUD_RULES_TEST: 'fraud_rules:test',
  ANALYTICS_VIEW: 'analytics:view',
  SIMULATION_RUN: 'simulation:run',
  CONSORTIUM_MANAGE: 'consortium:manage',
  CHARGEBACK_VIEW: 'chargeback:view',
};

export const ROLE_LABELS = {
  user: 'User',
  operator: 'Operator',
  admin: 'Admin',
};
