import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { getToken, setToken, clearToken } from "@/lib/api";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  owner: "Dueño",
  cashier: "Cajera",
  prep: "Preparación",
};

// Where each role lands after login.
export const HOME_BY_ROLE = {
  owner: "/dashboard",
  cashier: "/pos",
  prep: "/cocina",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
    const onUnauthorized = () => setUser(null);
    window.addEventListener("sh:unauthorized", onUnauthorized);
    return () => window.removeEventListener("sh:unauthorized", onUnauthorized);
  }, [loadMe]);

  const login = async (username, password) => {
    const { data } = await api.post("/auth/login", { username, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
