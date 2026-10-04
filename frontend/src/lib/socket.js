import { io } from "socket.io-client";
import { getToken } from "../api/client";

// Backend URL resolution (fail-closed in production):
// 1. VITE_SOCKET_URL when set (e.g. https://api.example.com) — required when
//    frontend and backend are on different origins.
// 2. Same-origin (`window.location.origin`) otherwise — in dev this hits the
//    Vite `/socket.io` proxy (see vite.config.js); in prod it works when both
//    are served from one origin. Never defaults to a hardcoded localhost in a
//    production build, so a missing env can't silently point at an attacker's
//    local imposter.
const resolveUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, "");
  if (envUrl) return envUrl;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return null;
};

let socket = null;
let lastToken = null;
let authFailed = false;

const readToken = () => {
  try {
    return getToken();
  } catch {
    return null;
  }
};

export const getSocket = () => {
  if (socket) return socket;
  const URL = resolveUrl();
  if (!URL) throw new Error("Socket URL could not be resolved");

  socket = io(URL, {
    autoConnect: false,
    // Function form re-reads storage on every (re)connect attempt, so a
    // rotated token (re-login) is picked up without rebuilding the singleton.
    auth: (cb) => cb({ token: readToken() }),
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("reconnect_attempt", () => {
    try {
      socket.auth = { token: readToken() };
    } catch {
      // best-effort
    }
  });

  // Auth rejection must NOT retry forever: a 401/403/inactive token spamming
  // reconnects is a self-DoS and hides the "session ended" state. Surface it
  // once, stop the engine, and let the app redirect to /login.
  socket.on("connect_error", (err) => {
    const msg = String(err?.message ?? "");
    const code = err?.data?.code ?? err?.code;
    const terminal =
      /unauthorized|forbidden|not active|invalid token|authentication/i.test(msg) ||
      code === "ACCOUNT_NOT_ACTIVE" ||
      err?.status === 401 ||
      err?.status === 403;
    if (terminal && !authFailed) {
      authFailed = true;
      try {
        socket.disconnect();
      } catch {
        // best-effort
      }
      window.dispatchEvent(
        new CustomEvent("socket:auth-failed", { detail: { message: msg, code } }),
      );
    }
  });

  socket.on("connect", () => {
    authFailed = false;
  });

  return socket;
};

// Preferred spelling (the old `connecSocket` typo is kept as an alias).
export const connectSocket = () => {
  const token = readToken();
  // Never open an anonymous transport: without a token the server rejects
  // the handshake anyway — skip the round-trip (and the error noise).
  if (!token) return null;
  const s = getSocket();
  // Token rotation: the singleton is created once, but login/logout rotates
  // localStorage. If the credential changed while connected, drop the stale
  // transport so the next handshake re-authenticates as the new identity.
  // (Previously the old identity stayed live after an account switch.)
  if (lastToken && token !== lastToken && s.connected) {
    try {
      s.disconnect();
    } catch {
      // best-effort
    }
  }
  lastToken = token;
  authFailed = false;
  try {
    s.auth = { token };
  } catch {
    // best-effort
  }
  if (!s.connected) {
    try {
      s.connect();
    } catch {
      // handshake failures surface via connect_error
    }
  } else {
    // Admins re-assert the admin-only ledger room (server re-checks the role).
    try {
      s.emit("transactions:join");
    } catch {
      // best-effort
    }
  }
  return s;
};

export const connecSocket = connectSocket;

export const disconnectSocket = () => {
  if (!socket) {
    lastToken = null;
    return;
  }
  try {
    // Remove EVERYTHING (including connect/disconnect/reconnect_attempt and
    // per-hook handlers) so a later login starts from a clean singleton and
    // no stale closure can act as the previous user.
    socket.removeAllListeners();
    if (socket.connected) socket.disconnect();
  } catch {
    // best-effort teardown
  } finally {
    socket = null;
    lastToken = null;
    authFailed = false;
  }
};

export const isSocketConnected = () => Boolean(socket?.connected);

export const didSocketAuthFail = () => authFailed;

export default { getSocket, connectSocket, connecSocket, disconnectSocket };
