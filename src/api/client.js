/**
 * SafePay — API client.
 * Attaches the JWT access token, and transparently refreshes it once on 401
 * using the stored refresh token.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const store = {
  get access() { return localStorage.getItem("safepay_token"); },
  set access(v) { v ? localStorage.setItem("safepay_token", v) : localStorage.removeItem("safepay_token"); },
  get refresh() { return localStorage.getItem("safepay_refresh"); },
  set refresh(v) { v ? localStorage.setItem("safepay_refresh", v) : localStorage.removeItem("safepay_refresh"); },
};

async function _fetch(path, options, useAuth) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (useAuth && store.access) headers.Authorization = `Bearer ${store.access}`;
  return fetch(`${BASE_URL}${path}`, { ...options, headers });
}

async function request(path, options = {}, { auth = true, retry = true } = {}) {
  let res = await _fetch(path, options, auth);

  if (res.status === 401 && retry && store.refresh) {
    const r = await _fetch("/auth/refresh", {
      method: "POST", body: JSON.stringify({ refresh_token: store.refresh }),
    }, false);
    if (r.ok) {
      const data = await r.json();
      store.access = data.access_token;
      store.refresh = data.refresh_token;
      res = await _fetch(path, options, auth);
    } else {
      store.access = null; store.refresh = null;
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const tokens = store;

export const authApi = {
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, { auth: false }),
  // No role param — the backend always creates a plain user (no privilege escalation).
  register: (email, password) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }, { auth: false }),
  me: () => request("/auth/me"),
};

export const txnApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  get: (id) => request(`/transactions/${id}`),
  review: (id, action) =>
    request(`/transactions/${id}/review`, { method: "POST", body: JSON.stringify({ action }) }),
  refund: (id, reason) =>
    request(`/transactions/${id}/refund`, { method: "POST", body: JSON.stringify({ reason }) }),
};

export const paymentApi = {
  // No user_id: the server charges the authenticated user only.
  process: (payload) =>
    request("/process-payment", { method: "POST", body: JSON.stringify(payload) }),
};

export const adminApi = {
  users: () => request("/admin/users"),
  stats: () => request("/admin/stats"),
  audit: () => request("/admin/audit"),
  retrain: () => request("/admin/retrain", { method: "POST" }),
  setRole: (id, role) => request(`/admin/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
};

export const chatApi = {
  send: (message) =>
    request("/chat", { method: "POST", body: JSON.stringify({ message }) }, { auth: true, retry: false }),
};

export const cashfreeApi = {
  createOrder: (payload) =>
    request("/cashfree/create-order", { method: "POST", body: JSON.stringify(payload) }),
  verifyOrder: (payload) =>
    request("/cashfree/verify-order", { method: "POST", body: JSON.stringify(payload) }),
};

export const healthApi = { check: () => request("/health", {}, { auth: false }) };
