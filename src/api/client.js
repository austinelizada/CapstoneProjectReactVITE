const rawApiBase = import.meta.env.VITE_API_BASE_URL;
let API_BASE;
if (rawApiBase) {
  const cleaned = rawApiBase.replace(/\/+$|\/api$/g, "");
  if (cleaned.startsWith(":") || /^:\d+$/.test(cleaned)) {
    const host = (typeof window !== "undefined" && window.location && window.location.hostname) || "localhost";
    const proto = (typeof window !== "undefined" && window.location && window.location.protocol) || "http:";
    API_BASE = `${proto}//${host}${cleaned}/api`;
  } else {
    API_BASE = cleaned + "/api";
  }
} else {
  API_BASE = "/api";
}

// Helpful runtime debug when devtools are open
try {
  // eslint-disable-next-line no-console
  console.debug("[api] API_BASE:", API_BASE);
} catch (e) {}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token && token !== "null" && token !== "undefined") {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "API request failed");
    error.response = response;
    error.data = data;
    throw error;
  }

  return data;
}
