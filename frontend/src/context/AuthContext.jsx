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
    } catch (err) {
      // Only a definitive auth rejection invalidates the session. Server
      // failures (network errors, 5xx, 502 from the dev proxy when the
      // backend is briefly down) keep the token so the session can be
      // restored on the next refresh once the backend is reachable again.
      if (err?.status === 401 || err?.status === 403) {
        clearAuth();
      }
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

  const issuedOtp = useCallback(async (payload) => {
    return authApi.issuedOtp(payload);
  }, []);

  const register = useCallback(
    async (payload) => {
      const response = await authApi.register(payload);

      // Only the first user (admin, active) receives a token at registration
      // and gets an immediate session. Employees are pending approval — the
      // backend sends no token, so they stay unauthenticated (see Register).
      if (response.token) {
        handleAuth(response);
      }

      return response;
    },
    [handleAuth],
  );

  const verifyOtp = useCallback(
    async (payload) => {
      const response = await authApi.verifyOtp(payload);

      // Active users get a token and an immediate session; pending users
      // still await administrator approval (response.message explains it).
      if (response.token) {
        handleAuth(response);
      }

      return response;
    },
    [handleAuth],
  );

  const logout = useCallback(() => {
    clearAuth();
    setLoading(false);
  }, [clearAuth]);

  const resendOtp = useCallback(async (payload) => {
    return authApi.resendOtp(payload);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        refresh,
        login,
        register,
        issuedOtp,
        verifyOtp,
        resendOtp,
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
