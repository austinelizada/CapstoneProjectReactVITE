import { apiFetch } from "./client";

export const getOrders = () => apiFetch("/orders");

export const getAdminOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/orders/admin/list${query ? `?${query}` : ""}`);
};

export const getAdminOrder = (orderId) => apiFetch(`/orders/admin/${orderId}`);

export const updateOrderStatus = (orderId, payload) =>
  apiFetch(`/orders/admin/${orderId}/status`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateOrderInspection = (orderId, payload) =>
  apiFetch(`/orders/admin/${orderId}/inspection`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const updateOrderProgress = (orderId, payload) =>
  apiFetch(`/orders/admin/${orderId}/progress`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const respondToContract = (orderId, payload) =>
  apiFetch(`/orders/${orderId}/contract`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const acceptContract = (orderId) => respondToContract(orderId, { action: "accept" });
export const declineContract = (orderId) => respondToContract(orderId, { action: "decline" });
export const respondToInstallationSchedule = (orderId, payload) =>
  apiFetch(`/orders/${orderId}/installation-schedule`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const createOrder = (payload) =>
  apiFetch("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createInspection = (payload) =>
  apiFetch("/orders/admin/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const trackOrder = (tracking) => apiFetch(`/orders/track/${encodeURIComponent(tracking)}`);

export const generateContract = (orderId, payload = {}) =>
  apiFetch(`/orders/admin/${orderId}/contract`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const sendWalkInApprovalEmail = (orderId, payload = {}) =>
  apiFetch(`/orders/admin/${orderId}/send-approval-email`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
