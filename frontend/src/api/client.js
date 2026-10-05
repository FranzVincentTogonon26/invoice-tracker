import axios from "axios";

const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const apiClient = axios.create({
  baseURL: "/api",
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Device clock for the audit trail: every mutating request carries the
  // device's own wall time so `backend/logs/transactions.md` records what
  // the user actually saw on their clock (e.g. 10-05-2025 2:33:13 PM),
  // not the server's UTC. Offset = minutes ahead of UTC.
  try {
    config.headers["X-Client-At"] = String(Date.now());
    config.headers["X-Client-Tz"] = String(-new Date().getTimezoneOffset());
  } catch {
    // best-effort: logging headers must never break a request
  }
  return config;
});

// 403 codes that mean "this session may no longer call this API at all": a
// suspended account, or a token whose role doesn't match the employee-only
// endpoints. Both end the session like a 401 would — the user is sent back to
// /login instead of keeping a half-valid session alive (anti-impersonation).
const TERMINAL_CODES = new Set([
  "ACCOUNT_NOT_ACTIVE",
  "EMPLOYEE_ACCESS_REQUIRED",
]);

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (
      (status === 401 || (status === 403 && TERMINAL_CODES.has(code))) &&
      getToken()
    ) {
      clearToken();
      if (!location.pathname.startsWith("/login")) location.assign("/login");
    }
    // Preserve the HTTP status alongside the API error body so callers can
    // distinguish definitive auth rejections (401/403) from server failures
    // (network errors, 502 from the dev proxy, 5xx) that should NOT log
    // the user out.
    return Promise.reject({
      ...error.response?.data,
      status: error.response?.status,
    });
  },
);
