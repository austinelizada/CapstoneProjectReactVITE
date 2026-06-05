import { apiFetch } from "./client";

export const searchCustomers = (query) =>
  apiFetch(`/auth/customers?search=${encodeURIComponent(query)}`);
