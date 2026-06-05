import { apiFetch } from "./client";

export const getOrders = () => apiFetch("/orders");

export const getAdminOrders = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/orders/admin/list${query ? `?${query}` : ""}`);
};

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

export const generateContract = (orderId) =>
  apiFetch(`/orders/admin/${orderId}/contract`, {
    method: "POST",
  });
