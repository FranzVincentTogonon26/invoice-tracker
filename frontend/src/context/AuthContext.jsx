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

  // Restore the session from a stored token on mount (e.g. after a refresh).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleAuth = useCallback(({ user, token }) => {
    if (!token) {
      throw new Error("Authentication failed: no token received.");
    }
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
      const response = await authApi.register(payload);

      // Accounts created with a pending status get no token until an admin
      // approves them — surface the message instead of storing a fake session.
      if (!response.token) {
        const pendingError = new Error(
          response.message ||
            "Account created. It is awaiting administrator approval.",
        );
        pendingError.accountPending = true;
        throw pendingError;
      }

      handleAuth(response);
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

// eslint-disable-next-line react-refresh/only-export-components -- context + hook belong together
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }

  return ctx;
}
