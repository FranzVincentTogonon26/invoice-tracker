import { apiClient, clearToken, getToken, setToken } from "./client";

// Re-exported so consumers can import token helpers alongside the auth API
export { clearToken, getToken, setToken };

export const authApi = {
  me: () => apiClient.get("/auth/me").then((r) => r.data),
  login: (payload) =>
    apiClient.post("/auth/login", payload).then((r) => r.data),
  register: (payload) =>
    apiClient.post("/auth/register", payload).then((r) => r.data),
  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
};
