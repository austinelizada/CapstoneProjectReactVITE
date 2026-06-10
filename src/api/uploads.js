import { apiFetch, API_BASE } from "./client";

const buildAuthHeaders = () => {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token && token !== "null" && token !== "undefined") {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const uploadFiles = async (files = [], onProgress) => {
  if (!files || files.length === 0) return { success: false, files: [] };

  const fd = new FormData();
  Array.from(files).forEach((file) => fd.append("files", file));
  const headers = buildAuthHeaders();

  if (typeof onProgress === "function") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/uploads`);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(response);
          } else {
            const error = new Error(response.message || `Upload failed with status ${xhr.status}`);
            error.response = response;
            reject(error);
          }
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error("Network error while uploading files."));
      xhr.send(fd);
    });
  }

  return apiFetch(`/uploads`, { method: "POST", body: fd });
};

export default { uploadFiles };
