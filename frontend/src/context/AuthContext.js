import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, {
  getToken,
  setToken,
  clearToken,
  getDeviceToken,
  setDeviceToken,
  clearDeviceToken,
  loginWithPin,
} from "@/lib/api";

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
  const [deviceActivated, setDeviceActivated] = useState(!!getDeviceToken());

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
    // An owner logging in on a device "activates" it: the same token is stored
    // as the long-lived device token so staff can later swap in by PIN.
    if (data.user.role === "owner") {
      setDeviceToken(data.token);
      setDeviceActivated(true);
    }
    setUser(data.user);
    return data.user;
  };

  const loginPin = async (pin) => {
    const pinUser = await loginWithPin(pin);
    setUser(pinUser);
    return pinUser;
  };

  // End the current shift without deactivating the device: the active identity
  // is cleared but the device token stays, so the next person can log in by PIN.
  const endShift = () => {
    clearToken();
    setUser(null);
  };

  // Full logout: clears the active identity AND deactivates the device.
  const logout = () => {
    clearToken();
    clearDeviceToken();
    setDeviceActivated(false);
    setUser(null);
  };

  const hasRole = (...roles) => !!user && roles.includes(user.role);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginPin, endShift, logout, hasRole, deviceActivated }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
