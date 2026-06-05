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
    ...options.headers,
  };

  // If body is not FormData, default to JSON content-type
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token && token !== "null" && token !== "undefined") {
    headers.Authorization = `Bearer ${token}`;
  }

  const maxRetries = options._retries || 3;
  let attempt = 0;
  let response;
  while (attempt < maxRetries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
      break;
    } catch (fetchError) {
      attempt += 1;
      const isLast = attempt >= maxRetries;
      if (isLast) {
        const message =
          fetchError?.message === "Failed to fetch"
            ? `Unable to connect to backend at ${API_BASE}. Please ensure the server is running and retry.`
            : fetchError?.message || "Network error while connecting to the API.";
        const error = new Error(message);
        error.cause = fetchError;
        error.isNetworkError = true;
        throw error;
      }
      // exponential backoff
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "API request failed");
    error.response = response;
    error.data = data;
    throw error;
  }

  return data;
}
