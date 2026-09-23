import { apiFetch } from "./client";

export const getCart = () => apiFetch("/cart");

export const saveCart = (items) =>
  apiFetch("/cart", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });