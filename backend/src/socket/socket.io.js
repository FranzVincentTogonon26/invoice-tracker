import { Server } from "socket.io";

import { ENV } from "../config/env.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import jwtToken from "../utils/jwt.js";
import { setIO } from "../realtime/index.js";

// Room names — membership is ROLE-SCOPED (security boundary):
// - `transactions` : ADMIN-ONLY global ledger room. Only admins auto-join;
//   only admins can join via `transactions:join`. Employees never see the
//   global feed — they get personal `user:<id>` pushes for rows that affect
//   them (issued to them, their own writes, force-logout).
// - `role:admin` / `role:employee` : role-targeted nudges.
// - `user:<user_id>` : personal room — balance changes / force-logout for
//   exactly one account.
// - `board:<uuid>` : legacy focused-view rooms. Join requires a valid UUID
//   and is rate-limited; never grants access to the rooms above.
export const ROOMS = {
  transactions: "transactions",
  role: (role) => `role:${role}`,
  user: (userId) => `user:${userId}`,
  // Legacy board rooms (kept so old `board:join` clients don't crash).
  board: (boardId) => `board:${boardId}`,
};

const boardRoom = (boardId) => ROOMS.board(boardId);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BOARD_ID_LEN = 64;

// --- Abuse guards (single-instance, in-memory — same scope as HTTP rateLimit) ---
// Handshake attempt throttle per IP: blunts credential-stuffing and
// connection-flood DoS without tracking concurrent slots (rejected handshakes
// never reach `connection`, so a slot counter would leak and lock out the IP
// after repeated failures — a window counter self-heals instead).
// Tune: 60 handshakes/min/IP is generous for tabs + reconnects.
const HANDSHAKE_WINDOW_MS = 60_000;
const MAX_HANDSHAKES_PER_WINDOW = 60;
const handshakeBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of handshakeBuckets) {
    if (b.resetAt <= now) handshakeBuckets.delete(ip);
  }
}, 60_000).unref?.();
const ipOf = (socket) =>
  socket.handshake.address ||
  socket.handshake.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
  socket.conn?.remoteAddress ||
  "unknown";

// Per-socket event throttle: max N client-originated events per window.
// Server-originated emits are unaffected. Exceeding it disconnects the
// offender (abuse) instead of punishing the room.
const EVENT_WINDOW_MS = 10_000;
const MAX_EVENTS_PER_WINDOW = 30;
const eventBuckets = new WeakMap();
const checkEventRate = (socket) => {
  const now = Date.now();
  let bucket = eventBuckets.get(socket);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + EVENT_WINDOW_MS };
    eventBuckets.set(socket, bucket);
  }
  bucket.count += 1;
  return bucket.count <= MAX_EVENTS_PER_WINDOW;
};
const onClientEvent = (socket, event) => {
  if (checkEventRate(socket)) return true;
  console.warn(
    `socket rate-limited: user=${socket.user?.id ?? "?"} event=${event}`,
  );
  try {
    socket.emit("error:rate_limited", {
      event,
      message: "Too many requests. Slow down and reconnect if needed.",
    });
    socket.disconnect(true);
  } catch {
    // best-effort
  }
  return false;
};

const clientIp = (socket) => {
  try {
    return ipOf(socket);
  } catch {
    return "unknown";
  }
};

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      // Exact-match allowlist (never "*"): the browser sends Origin and the
      // handshake is rejected anywhere else. ENV.CLIENT_URL is required at
      // boot (config/env.js) so a missing value fails closed, not open.
      origin: ENV.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Smallest surface that still fits the protocol: client events carry only
    // room ids / acks (bytes), never files or bodies. A 100KB cap stops a
    // malicious client stuffing huge payloads into `board:join` etc.
    maxHttpBufferSize: 100 * 1024,
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectTimeout: 10_000,
  });

  // Handshake-flood guard (runs before auth — cheap, no DB touch).
  // Window-based (not slot-based) so rejected handshakes can't leak a lock.
  io.use((socket, next) => {
    const ip = clientIp(socket);
    const now = Date.now();
    let bucket = handshakeBuckets.get(ip);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + HANDSHAKE_WINDOW_MS };
      handshakeBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > MAX_HANDSHAKES_PER_WINDOW) {
      return next(ApiError.tooManyRequests("Too many connections", "RATE_LIMITED"));
    }
    socket.data.ip = ip;
    next();
  });

  // Same guarantees as HTTP authMiddleware: valid JWT -> real users row ->
  // status must be 'active'. Role comes from the DB row, never the token
  // alone, so a tampered or stale token can't escalate. Token travels in the
  // `auth` payload (never the URL query), so it never lands in proxy logs.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (!token || typeof token !== "string" || token.length > 4096) {
        throw ApiError.unauthorized("Authentication required");
      }

      const decoded = jwtToken.verify(token);
      const userId = decoded.user_id ?? decoded.userId ?? decoded.id;
      if (!userId || typeof userId !== "string") {
        throw ApiError.unauthorized("Invalid token payload");
      }

      const user = await User.findUserById(userId);
      if (!user) throw ApiError.unauthorized("User not found");
      if (user.status !== "active") {
        throw ApiError.forbidden(
          "Your account is not active. Please contact an administrator.",
          "ACCOUNT_NOT_ACTIVE",
        );
      }
      if (user.role !== "admin" && user.role !== "employee") {
        throw ApiError.forbidden("Access denied.", "ACCESS_DENIED");
      }

      socket.user = {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      socket.data.user = socket.user;
      // Kick the socket when its JWT expires: a long-lived connection must
      // not outlive the credential it authenticated with. The client
      // reconnects with a fresh token (see frontend lib/socket.js).
      try {
        const expMs = (decoded.exp ?? 0) * 1000;
        if (expMs > Date.now()) {
          const delay = Math.min(expMs - Date.now() + 30_000, 2_147_483_647);
          const timer = setTimeout(() => {
            try {
              socket.emit("force:reconnect", {
                reason: "Session expired. Reconnecting…",
                timestamp: new Date().toISOString(),
              });
              socket.disconnect(true);
            } catch {
              // best-effort
            }
          }, delay);
          if (typeof timer.unref === "function") timer.unref();
          socket.data.expTimer = timer;
        }
      } catch {
        // expiry kick is best-effort; auth itself already passed
      }

      next();
    } catch (err) {
      if (err?.isApiError) return next(err);
      next(ApiError.unauthorized("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;

    // ROLE-SCOPED auto-join. Admins get the global ledger; employees get only
    // their role room + personal room. No client emit can escalate this —
    // `transactions:join` below re-checks the role server-side.
    try {
      if (user.role === "admin") socket.join(ROOMS.transactions);
      socket.join(ROOMS.role(user.role));
      socket.join(ROOMS.user(user.id));
    } catch (err) {
      console.error("socket auto-join error:", err);
    }

    // Tell the newcomer who they are + confirm the subscription. Personal
    // room id is echoed (it is their own id); nothing about other users.
    socket.emit("connection:ready", {
      user: { id: user.id, name: user.name, role: user.role },
      rooms:
        user.role === "admin"
          ? [ROOMS.transactions, ROOMS.role(user.role), ROOMS.user(user.id)]
          : [ROOMS.role(user.role), ROOMS.user(user.id)],
      timestamp: new Date().toISOString(),
    });

    // Notify admins that an employee came online (employee activity feed).
    // Admins themselves are excluded to keep the noise down.
    if (user.role === "employee") {
      socket.to(ROOMS.role("admin")).emit("employee:online", {
        user: { id: user.id, name: user.name, email: user.email },
        timestamp: new Date().toISOString(),
      });
    }

    // Focused ledger view. ADMIN-ONLY: the global feed carries every
    // employee's amounts, so an employee token must never be able to join it.
    socket.on("transactions:join", (ack) => {
      try {
        if (!onClientEvent(socket, "transactions:join")) return;
        if (socket.user?.role !== "admin") {
          if (typeof ack === "function")
            ack({ ok: false, error: "Admin access required" });
          return;
        }
        socket.join(ROOMS.transactions);
        if (typeof ack === "function")
          ack({ ok: true, room: ROOMS.transactions });
      } catch (err) {
        console.error("transactions:join error:", err);
        if (typeof ack === "function")
          ack({ ok: false, error: "Failed to join transactions" });
      }
    });

    socket.on("transactions:leave", () => {
      try {
        if (!onClientEvent(socket, "transactions:leave")) return;
        socket.leave(ROOMS.transactions);
      } catch {
        // best-effort
      }
    });

    // Legacy board API — validated: non-string / oversized / non-UUID ids are
    // rejected without joining anything. Rooms stay under the `board:` prefix
    // so they can never collide with `transactions` / `role:*` / `user:*`.
    socket.on("board:join", async (boardId, ack) => {
      try {
        if (!onClientEvent(socket, "board:join")) return;
        if (
          typeof boardId !== "string" ||
          boardId.length === 0 ||
          boardId.length > MAX_BOARD_ID_LEN ||
          !UUID_RE.test(boardId)
        ) {
          if (typeof ack === "function")
            ack({ ok: false, error: "Invalid board id" });
          return;
        }
        socket.join(boardRoom(boardId));
        socket.emit("presence:sync", {
          user: { id: user.id, name: user.name },
          boardId,
        });
        if (typeof ack === "function") ack({ ok: true });
      } catch (err) {
        console.error("board:join error:", err);
        if (typeof ack === "function")
          ack({ ok: false, error: "Failed to join board" });
      }
    });

    socket.on("board:leave", (boardId) => {
      try {
        if (!onClientEvent(socket, "board:leave")) return;
        if (typeof boardId !== "string" || !UUID_RE.test(boardId)) return;
        socket.leave(boardRoom(boardId));
        socket.to(boardRoom(boardId)).emit("presence:leave", {
          user: { id: user.id, name: user.name },
          boardId,
        });
      } catch {
        // best-effort
      }
    });

    const releaseSlot = () => {
      try {
        const ip = socket.data.ip ?? clientIp(socket);
        const left = (socketsPerIp.get(ip) ?? 1) - 1;
        if (left <= 0) socketsPerIp.delete(ip);
        else socketsPerIp.set(ip, left);
      } catch {
        // best-effort
      }
      try {
        if (socket.data.expTimer) clearTimeout(socket.data.expTimer);
      } catch {
        // best-effort
      }
      eventBuckets.delete(socket);
    };

    // Presence is admin-directed only: broadcasting disconnects to the global
    // room would leak who-is-online to every employee. Personal `user:<id>`
    // rooms are skipped (they contain only that user). Legacy `board:*`
    // rooms keep their scoped leave notice.
    socket.on("disconnecting", () => {
      try {
        for (const room of socket.rooms) {
          if (room === socket.id) continue;
          if (!room.startsWith("board:")) continue;
          const boardId = room.slice("board:".length);
          socket.to(room).emit("presence:leave", {
            user: { id: user.id, name: user.name },
            boardId,
          });
        }
        if (user.role === "employee") {
          socket.to(ROOMS.role("admin")).emit("employee:offline", {
            user: { id: user.id, name: user.name },
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // best-effort
      }
    });

    socket.on("disconnect", releaseSlot);
    socket.on("error", releaseSlot);
  });

  setIO(io);
  return io;
};
