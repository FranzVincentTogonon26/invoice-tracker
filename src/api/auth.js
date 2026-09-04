import { mock } from "../mock/dummyApi";

const TOKEN_KEY = "token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const authApi = {
  me: () => mock.auth.me(),
  login: (payload) => mock.auth.login(payload),
};
