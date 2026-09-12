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
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && getToken()) {
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
