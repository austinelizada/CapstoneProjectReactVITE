import { apiFetch } from "./client";

export const register = (payload) => apiFetch("/auth/register", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const login = (payload) => apiFetch("/auth/login", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const adminExists = () => apiFetch("/auth/admin-exists");

export const createAdmin = (payload) => apiFetch("/auth/create-admin", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const getMe = () => apiFetch("/auth/me");

export const updateProfile = (payload) => apiFetch("/auth/profile", {
  method: "PUT",
  body: JSON.stringify(payload),
});
