import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
// import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  //   const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const { user } = await authApi.login(credentials);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (payload) => {
    const { user } = await authApi.register(payload);
    setUser(user);
    return user;
  }, []);

  return (
    <AuthContext.Provider value={{ loading, user, refresh, login, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
