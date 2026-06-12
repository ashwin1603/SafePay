import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi, tokens } from "../api/client";

const AuthContext = createContext(null);

function persistUser(data, email) {
  tokens.access = data.access_token;
  tokens.refresh = data.refresh_token;
  const userObj = { id: data.user_id, email, role: data.role, permissions: [] };
  localStorage.setItem("safepay_user", JSON.stringify(userObj));
  return userObj;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("safepay_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [ready, setReady] = useState(false);

  // Pull the authoritative role + permission set from the server.
  const refreshMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser((prev) => {
        const next = { ...(prev || {}), id: me.id, email: me.email,
                       role: me.role, permissions: me.permissions || [] };
        localStorage.setItem("safepay_user", JSON.stringify(next));
        return next;
      });
    } catch (_) {
      // token invalid/expired — treat as logged out
      tokens.access = null; tokens.refresh = null;
      localStorage.removeItem("safepay_user");
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (tokens.access) refreshMe();
    else setReady(true);
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    persistUser(await authApi.login(email, password), email);
    await refreshMe();
  }, [refreshMe]);

  const register = useCallback(async (email, password) => {
    persistUser(await authApi.register(email, password), email);
    await refreshMe();
  }, [refreshMe]);

  const logout = useCallback(() => {
    tokens.access = null; tokens.refresh = null;
    localStorage.removeItem("safepay_user");
    setUser(null);
  }, []);

  const can = useCallback(
    (perm) => !!user?.permissions?.includes(perm),
    [user]
  );
  const canAny = useCallback(
    (...perms) => perms.some((p) => user?.permissions?.includes(p)),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, can, canAny }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
