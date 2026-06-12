import { createContext, useContext, useState, useCallback } from "react";
import { authApi, tokens } from "../api/client";

const AuthContext = createContext(null);

function persist(data, email) {
  tokens.access = data.access_token;
  tokens.refresh = data.refresh_token;
  const userObj = { id: data.user_id, email, role: data.role };
  localStorage.setItem("safepay_user", JSON.stringify(userObj));
  return userObj;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("safepay_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    setUser(persist(await authApi.login(email, password), email));
  }, []);

  const register = useCallback(async (email, password) => {
    setUser(persist(await authApi.register(email, password), email));
  }, []);

  const logout = useCallback(() => {
    tokens.access = null; tokens.refresh = null;
    localStorage.removeItem("safepay_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
