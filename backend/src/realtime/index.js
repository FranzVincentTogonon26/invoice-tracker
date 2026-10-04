import { logTransaction } from "../utils/transactionLogger.js";

let io = null;

const setIO = (instance) => {
  io = instance;
};

const getIO = () => io;

const ROOM_TRANSACTIONS = "transactions";
const roleRoom = (role) => `role:${role}`;
const userRoom = (userId) => `user:${userId}`;

// Payload allowlists — anything outside these is dropped before broadcast so
// a compromised/buggy controller can't push arbitrary shapes (or huge blobs)
// to every connected client.
const ALLOWED_ACTIONS = new Set([
  "create",
  "update",
  "delete",
  "status",
  "settle",
  "transfer",
]);
const ALLOWED_ENTITIES = new Set([
  "transaction",
  "budget",
  "issued-budget",
  "budget-reference",
  "expense",
  "abono",
  "transfer",
  "employee",
  "category",
  "activity",
]);
const MAX_MESSAGE_LEN = 300;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cleanStr = (v, max = MAX_MESSAGE_LEN) => {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
  return s;
};

const cleanId = (v) => {
  if (typeof v !== "string" || v.length > 64) return null;
  if (UUID_RE.test(v)) return v;
  // Allow only short opaque ids; anything else is dropped, never broadcast.
  return /^[A-Za-z0-9:_-]{1,64}$/.test(v) ? v : null;
};

// Low-level emit — never throws, so a socket outage can't fail a request.
const emit = (event, payload, { to = null } = {}) => {
  try {
    if (!io) return false;
    if (to) io.to(to).emit(event, payload);
    else io.emit(event, payload);
    return true;
  } catch (err) {
    console.error(`realtime emit "${event}" failed:`, err?.message ?? err);
    return false;
  }
};

/**
 * Broadcast a money movement with ROLE-SCOPED fan-out (security boundary):
 * - Full payload (actor email, full metadata) -> `role:admin` + global
 *   `transactions` room (both admin-only rooms).
 * - Redacted payload (no emails, truncated message, only own ids) ->
 *   `user:<id>` rooms in `notifyUserIds` (the employee(s) this row affects).
 * Employees can therefore never snoop other employees' amounts via the
 * global feed — they only learn about rows scoped to their own account.
 * Frontend listens on `transactions:changed` to invalidate react-query caches
 * and on `balance:changed` / `employee:activity` for toasts and badges.
 *
 * @param {object} opts
 * @param {"create"|"update"|"delete"|"status"|"settle"|"transfer"} opts.action
 * @param {string} opts.entity budget | issued-budget | expense | abono | transfer | employee | category
 * @param {object} [opts.actor] req.user ({ id, name, email, role })
 * @param {string} [opts.message]
 * @param {object} [opts.metadata] ids, amounts, affected user ids
 * @param {string[]} [opts.notifyUserIds] extra `user:<id>` rooms to push to
 * @param {boolean} [opts.adminOnly] only admins need this (e.g. account status)
 */
const emitTransaction = (opts = {}) => {
  const rawAction = opts.action ?? "update";
  const rawEntity = opts.entity ?? "transaction";
  // Invalid shapes fail closed to a generic "update · transaction" rather
  // than broadcasting attacker-influenced strings to every client.
  const action = ALLOWED_ACTIONS.has(rawAction) ? rawAction : "update";
  const entity = ALLOWED_ENTITIES.has(rawEntity) ? rawEntity : "transaction";
  const { actor = null, message = "", metadata = {} } = opts;
  const notifyUserIds = Array.isArray(opts.notifyUserIds)
    ? opts.notifyUserIds
    : [];
  const adminOnly = Boolean(opts.adminOnly);

  const amount =
    Number.isFinite(Number(metadata.amount)) &&
    String(metadata.amount).length < 32
      ? Number(metadata.amount)
      : null;

  const fullPayload = {
    action,
    entity,
    actor: actor
      ? {
          id: cleanId(actor.id),
          name: cleanStr(actor.name, 120),
          email: typeof actor.email === "string" ? actor.email.slice(0, 160) : null,
          role: actor.role === "admin" ? "admin" : "employee",
        }
      : null,
    message: cleanStr(message),
    metadata: {
      ...(amount !== null ? { amount } : {}),
      ...(cleanId(metadata.id) ? { id: cleanId(metadata.id) } : {}),
      ...(cleanId(metadata.userId) ? { userId: cleanId(metadata.userId) } : {}),
      ...(cleanId(metadata.senderId) ? { senderId: cleanId(metadata.senderId) } : {}),
      ...(cleanId(metadata.transferTo)
        ? { transferTo: cleanId(metadata.transferTo) }
        : {}),
      ...(cleanId(metadata.reference_id)
        ? { reference_id: cleanId(metadata.reference_id) }
        : {}),
      ...(cleanId(metadata.transferId)
        ? { transferId: cleanId(metadata.transferId) }
        : {}),
      ...(cleanId(metadata.abonoId) ? { abonoId: cleanId(metadata.abonoId) } : {}),
      ...(cleanId(metadata.budgetId) ? { budgetId: cleanId(metadata.budgetId) } : {}),
      ...(cleanId(metadata.issuedId) ? { issuedId: cleanId(metadata.issuedId) } : {}),
      ...(cleanId(metadata.categoryId)
        ? { categoryId: cleanId(metadata.categoryId) }
        : {}),
      ...(typeof metadata.status === "string"
        ? { status: cleanStr(metadata.status, 32) }
        : {}),
      ...(typeof metadata.method === "string"
        ? { method: cleanStr(metadata.method, 32) }
        : {}),
      ...(typeof metadata.label === "string"
        ? { label: cleanStr(metadata.label, 120) }
        : {}),
      ...(Number.isFinite(Number(metadata.count))
        ? { count: Math.min(Math.trunc(Number(metadata.count)), 100000) }
        : {}),
    },
    timestamp: new Date().toISOString(),
  };

  // 1) Persist to the .MD log FIRST — the audit trail survives even if nobody
  //    is connected. The file log keeps the full actor line (server-side only,
  //    never broadcast); see transactionLogger for the on-disk format.
  try {
    logTransaction({ action, entity, actor, message: fullPayload.message, metadata: fullPayload.metadata });
  } catch (err) {
    console.error("realtime log failed:", err?.message ?? err);
  }

  if (!io) return fullPayload;

  // Redacted copy for personal rooms: no emails, truncated message, no
  // cross-user metadata. An employee learns "something changed on my account"
  // and refetches their own ledger over HTTP (which re-enforces RBAC) —
  // never another employee's amounts.
  const personalPayload = {
    ...fullPayload,
    actor: fullPayload.actor
      ? { id: fullPayload.actor.id, name: fullPayload.actor.name, role: fullPayload.actor.role }
      : null,
  };

  // 2) Admin-only global ledger room + admin role room get the full payload.
  emit("transactions:changed", fullPayload, { to: ROOM_TRANSACTIONS });
  if (!adminOnly) emit("balance:changed", fullPayload, { to: roleRoom("admin") });
  else emit("transactions:changed", fullPayload, { to: roleRoom("admin") });

  // 3) Personal rooms get the redacted copy (skipped for adminOnly events).
  if (!adminOnly) {
    const targets = [
      ...new Set(notifyUserIds.map(cleanId).filter(Boolean)),
    ].slice(0, 10);
    for (const uid of targets) {
      emit("balance:changed", personalPayload, { to: userRoom(uid) });
      emit("transactions:changed", personalPayload, { to: userRoom(uid) });
    }
  }

  // 4) Employee-activity feed for admins — every employee write surfaces here
  //    with top priority (this is the "moving money" radar).
  if (actor?.role === "employee") {
    emit("employee:activity", fullPayload, { to: roleRoom("admin") });
  }

  return fullPayload;
};

// Back-compat: old `board:<id>` helper (was exported but never defined).
const boardRoom = (boardId) => `board:${boardId}`;

const emitToUser = (userId, event, payload) =>
  emit(event, payload, { to: userRoom(userId) });

const emitToAdmins = (event, payload) =>
  emit(event, payload, { to: roleRoom("admin") });

// Force-logout one account everywhere (used when an employee is deactivated).
// Emits the notice AND server-side disconnects every socket in that personal
// room — a malicious client that ignores the event still loses the transport
// and gets no further realtime data. HTTP auth already rejects their next
// API call (status check), so the account is cut off on both channels.
const emitForceLogout = (userId, reason = "Your account status changed.") => {
  const uid = cleanId(userId);
  if (!uid) return false;
  const payload = {
    reason: cleanStr(reason, 200),
    timestamp: new Date().toISOString(),
  };
  const emitted = emit("force:logout", payload, { to: userRoom(uid) });
  try {
    if (io && typeof io.in === "function") {
      const targets = io.in(userRoom(uid));
      if (targets && typeof targets.disconnectSockets === "function") {
        targets.disconnectSockets(true);
      }
    }
  } catch (err) {
    console.error("force-logout kick failed:", err?.message ?? err);
  }
  return emitted;
};

// Server-side kick without the toast (e.g. token replaced / role changed).
const disconnectUserSockets = (userId) => {
  const uid = cleanId(userId);
  if (!uid || !io) return false;
  try {
    io.in(userRoom(uid)).disconnectSockets(true);
    return true;
  } catch (err) {
    console.error("disconnectUserSockets failed:", err?.message ?? err);
    return false;
  }
};

// Legacy activity logger — kept for old imports, now backed by the .MD log.
const logActivity = async ({ action = "update", entity = "activity", actor = null, message = "", metadata = {} } = {}) =>
  emitTransaction({ action, entity, actor, message, metadata });

export {
  setIO,
  getIO,
  emit,
  emitTransaction,
  emitToUser,
  emitToAdmins,
  emitForceLogout,
  disconnectUserSockets,
  logActivity,
  boardRoom,
  ROOM_TRANSACTIONS,
};
