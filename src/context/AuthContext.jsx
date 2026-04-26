import { createContext, useContext, useState, useCallback } from "react";
import { authApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("safepay_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const data = await authApi.login(email, password);
    localStorage.setItem("safepay_token", data.access_token);
    const userObj = { id: data.user_id, email, role: data.role };
    localStorage.setItem("safepay_user", JSON.stringify(userObj));
    setUser(userObj);
    return data;
  }, []);

  const register = useCallback(async (email, password, role) => {
    const data = await authApi.register(email, password, role);
    localStorage.setItem("safepay_token", data.access_token);
    const userObj = { id: data.user_id, email, role: data.role };
    localStorage.setItem("safepay_user", JSON.stringify(userObj));
    setUser(userObj);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("safepay_token");
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
