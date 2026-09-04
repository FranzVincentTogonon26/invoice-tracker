import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { authApi, clearToken, getToken, setToken } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // Restores the session from a stored token (e.g. after a browser refresh)
  // and can also be called manually to re-fetch the current user.
  const refresh = useCallback(async () => {
    if (!getToken()) {
      clearAuth();
      setLoading(false);
      return null;
    }

    try {
      const { user } = await authApi.me();
      setUser(user);
      return user;
    } catch {
      clearAuth();
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!getToken()) {
        if (!cancelled) {
          clearAuth();
          setLoading(false);
        }
        return;
      }

      try {
        const { user } = await authApi.me();

        if (!cancelled) {
          setUser(user);
        }
      } catch {
        if (!cancelled) {
          clearAuth();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearAuth]);

  const handleAuth = useCallback(({ user, token }) => {
    setToken(token);
    setUser(user);
  }, []);

  const login = useCallback(
    async (credentials) => {
      handleAuth(await authApi.login(credentials));
    },
    [handleAuth],
  );

  const register = useCallback(
    async (payload) => {
      handleAuth(await authApi.register(payload));
    },
    [handleAuth],
  );

  const logout = useCallback(() => {
    clearAuth();
    setLoading(false);
  }, [clearAuth]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        refresh,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }

  return ctx;
}
