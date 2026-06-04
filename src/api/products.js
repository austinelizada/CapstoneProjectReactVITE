import { apiFetch } from "./client";

export const getProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.category) query.append("category", params.category);
  return apiFetch(`/products?${query.toString()}`);
};

export const getProduct = (id) => apiFetch(`/products/${id}`);

export const createProduct = (payload) => apiFetch("/products", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const updateProduct = (id, payload) => apiFetch(`/products/${id}`, {
  method: "PUT",
  body: JSON.stringify(payload),
});

export const deleteProduct = (id) => apiFetch(`/products/${id}`, {
  method: "DELETE",
});
