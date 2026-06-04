/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import {
  login as loginApi,
  register as registerApi,
  getMe,
  adminExists as adminExistsApi,
  createAdmin as createAdminApi,
  updateProfile as updateProfileApi,
} from "@/api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [adminExists, setAdminExists] = useState(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState("");

  const setToken = (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  };

  const setUserAndPersist = (userData) => {
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
    } else {
      localStorage.removeItem("user");
      setUser(null);
    }
  };

  const loadUser = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUserAndPersist(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await getMe();
      setUserAndPersist(response.user);
    } catch (error) {
      const status = error.response?.status;
      const message = error.data?.message || error.message || "";

      if (!(status === 401 || status === 404 || /invalid|expired|not found/i.test(message))) {
        console.error("Failed to load current user", error);
      }

      if (
        status === 401 ||
        status === 404 ||
        /invalid|expired|not found/i.test(message)
      ) {
        setToken(null);
        setUserAndPersist(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAdminStatus = async () => {
    try {
      const response = await adminExistsApi();
      if (response && typeof response.exists !== "undefined") {
        setAdminExists(response.exists === true);
        setAdminError("");
      } else {
        setAdminError("Unexpected admin status response from server.");
        setAdminExists(null);
      }
    } catch (error) {
      console.error("Failed to load admin status", error);
      setAdminError(error.data?.message || error.message || "Failed to check admin existence");
      setAdminExists(null);

      // Retry once for transient network issues
      try {
        const retry = await adminExistsApi();
        if (retry && typeof retry.exists !== "undefined") {
          setAdminExists(retry.exists === true);
          setAdminError("");
        }
      } catch (err) {
        console.error("Retry admin status failed", err);
      }
    } finally {
      setAdminLoading(false);
    }
  };

  const refreshAdminStatus = async () => {
    setAdminLoading(true);
    setAdminError("");
    await loadAdminStatus();
  };

  useEffect(() => {
    const initAuth = async () => {
      await loadUser();
      await loadAdminStatus();
    };

    initAuth();
  }, []);

  const login = async ({ identifier, password }) => {
    setAuthError("");
    const response = await loginApi({ identifier, password });
    setToken(response.token);
    setUserAndPersist(response.user);
    return response;
  };

  const register = async (payload) => {
    setAuthError("");
    const response = await registerApi(payload);
    setToken(response.token);
    setUserAndPersist(response.user);
    return response;
  };

  const createAdmin = async (payload) => {
    setAuthError("");
    const response = await createAdminApi(payload);
    setToken(response.token);
    setUserAndPersist(response.user);
    setAdminExists(true);
    return response;
  };

  const updateProfile = async (payload) => {
    setAuthError("");
    const response = await updateProfileApi(payload);
    setUserAndPersist(response.user);
    return response;
  };

  const logout = () => {
    setToken(null);
    setUserAndPersist(null);
  };

  const value = {
    user,
    loading,
    adminExists,
    adminLoading,
    adminError,
    login,
    register,
    createAdmin,
    updateProfile,
    logout,
    refreshAdminStatus,
    authError,
    setAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
