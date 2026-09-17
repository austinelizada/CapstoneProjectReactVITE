import { apiFetch, API_BASE } from "./client";

export const searchCustomers = (query) =>
  apiFetch(`/auth/customers?search=${encodeURIComponent(query)}`);

export const getAdminUsers = (params = {}) => {
  const query = new URLSearchParams();
  if (params.role && params.role !== "all") query.set("role", params.role);
  if (params.search) query.set("search", params.search);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch(`/auth/users${suffix}`);
};

export const updateAdminUserAccess = (userId, payload) =>
  apiFetch(`/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const getSystemSettings = () => apiFetch("/auth/system-settings");

export const updateSystemSettings = (payload) =>
  apiFetch("/auth/system-settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

export const getSystemSettingsEventsUrl = () => {
  const token = localStorage.getItem("token");
  const base = (API_BASE || "").replace(/\/$/, "");
  return `${base}/auth/system-settings/events?token=${encodeURIComponent(token || "")}`;
};
