import { apiFetch } from "./client";

export const uploadFiles = async (files = []) => {
  if (!files || files.length === 0) return { success: false, files: [] };
  const fd = new FormData();
  Array.from(files).forEach((file) => fd.append("files", file));
  return apiFetch(`/uploads`, { method: "POST", body: fd });
};

export default { uploadFiles };
