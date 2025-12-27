// Use relative path in development (via Vite proxy) or absolute URL in production
// In dev mode, empty string uses Vite proxy. In production, use VITE_API_BASE_URL
const BASE_URL = import.meta.env.DEV 
  ? (import.meta.env.VITE_API_BASE_URL || "")
  : (import.meta.env.VITE_API_BASE_URL || "");

// Global loading state management
let loadingCallbacks = {
  show: null,
  hide: null,
};

export function setLoadingCallbacks(show, hide) {
  loadingCallbacks.show = show;
  loadingCallbacks.hide = hide;
}

// Get auth token from cache (synchronous, no async needed)
function getAuthToken() {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('auth_token') || null;
  }
  return null;
}

async function request(path, options = {}) {
  // In dev mode, empty BASE_URL is allowed (uses Vite proxy)
  // In production, BASE_URL must be set
  if (!import.meta.env.DEV && !BASE_URL) {
    throw new Error("API base URL not configured. Set VITE_API_BASE_URL.");
  }

  // Show loading
  if (loadingCallbacks.show) {
    loadingCallbacks.show();
  }

  try {
    // Get token from cache (synchronous)
    const token = getAuthToken();
    
    // Build headers with auth token if available
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const buildUrl = (base, p) => {
      const b = (base || "").replace(/\/+$/, "");
      const ps = (p || "");
      const p2 = ps.startsWith("/") ? ps : `/${ps}`;
      if (b.endsWith("/api") && p2.startsWith("/api/")) {
        return `${b}${p2.slice(4)}`;
      }
      return `${b}${p2}`;
    };

    const res = await fetch(buildUrl(BASE_URL, path), {
      headers,
      ...options,
    });
    
    let body;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }
    
    if (!res.ok) {
      // Extract error message - handle both string and object errors
      let msg = "Request failed";
      if (typeof body === "string") {
        msg = body;
      } else if (body) {
        msg = body.message || body.detail || body.error || 
              (typeof body.error === 'string' ? body.error : 
               (body.error?.message || body.error?.detail || JSON.stringify(body.error))) ||
              JSON.stringify(body);
      }
      const error = new Error(msg);
      error.status = res.status;
      error.statusText = res.statusText;
      error.body = body; // Include full body for debugging
      throw error;
    }
    
    return body;
  } finally {
    // Hide loading
    if (loadingCallbacks.hide) {
      // Small delay to prevent flickering on fast requests
      setTimeout(() => {
        loadingCallbacks.hide();
      }, 100);
    }
  }
}

export async function get(path, options = {}) {
  return request(path, options);
}

export async function post(path, data) {
  return request(path, { method: "POST", body: JSON.stringify(data) });
}

export async function put(path, data) {
  return request(path, { method: "PUT", body: JSON.stringify(data) });
}

export async function patch(path, data) {
  return request(path, { method: "PATCH", body: JSON.stringify(data) });
}

export async function del(path) {
  return request(path, { method: "DELETE" });
}
