/**
 * SafePay Flow — API Client
 * Centralised fetch wrapper that attaches JWT bearer token + base URL.
 */

const BASE_URL = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("safepay_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email, password, role = "user") =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
};

// ── Transactions ──────────────────────────────────────────────────────────────

export const txnApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },

  get: (id) => request(`/transactions/${id}`),
};

// ── Payments ──────────────────────────────────────────────────────────────────

export const paymentApi = {
  process: (payload) =>
    request("/process-payment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ── Admin ─────────────────────────────────────────────────────────────────────

export const adminApi = {
  users: () => request("/admin/users"),
  stats: () => request("/admin/stats"),
  retrain: () => request("/admin/retrain", { method: "POST" }),
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthApi = {
  check: () => request("/health"),
};
