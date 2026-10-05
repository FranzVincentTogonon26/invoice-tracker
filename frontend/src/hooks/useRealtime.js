import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { connectSocket, getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthContext";

// Query keys that show money — refreshed on every `transactions:changed`.
const MONEY_KEYS = [
  ["transactions"],
  ["budgets"],
  ["expenses"],
  ["employeeExpenses"],
  ["abono"],
  ["employeeAbono"],
  ["budgetTransfer"],
  ["employeeOverview"],
  ["employeeBudget"],
  ["employees"],
  // Admin audit trail (sourced from backend/logs/transactions.md) — every
  // money event appends a row there, so the visible page refetches live.
  ["auditLogs"],
];

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

// Inbound guard: the server signs nothing, but only the server can emit these
// events on an authenticated transport. Still, validate shape + bound length
// before touching caches or toasts so a malformed/oversized payload can never
// drive the UI (defense in depth; server already allowlists + truncates).
const isValidPayload = (p) =>
  Boolean(
    p &&
      typeof p === "object" &&
      ALLOWED_ACTIONS.has(p.action) &&
      ALLOWED_ENTITIES.has(p.entity),
  );

const safeText = (v, max = 200) => {
  if (typeof v !== "string") return "";
  // Strip control chars (terminal/ANSI injection) and bound length.
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, max);
};

/**
 * Global realtime subscription. Mount ONCE near the root (App) while a user
 * is signed in.
 *
 * TOAST POLICY (actor-only): success/error popups fire ONLY on the device
 * that performed the action, from that action's own mutation handler
 * (BudgetModal, AddExpenses, BudgetTransfer, row actions, ...). Socket
 * events NEVER toast about someone else's activity — they only invalidate
 * react-query caches so every ledger refreshes silently:
 * - `transactions:changed` -> invalidate every money query (admin ledger +
 *   all employee ledgers stay in sync without refetch spam). No toast.
 * - `balance:changed` -> same invalidation, no toast (too noisy).
 * - `employee:activity` -> same invalidation, no toast (admin radar is
 *   silent; the employee already toasted on their own device).
 * Personally-targeted security notices still toast because they ARE about
 * you:
 * - `force:logout` -> session ended by admin (deactivated/removed).
 * - `force:reconnect` -> credential expired; transport already dropped
 *   server-side, reconnect with the fresh token.
 * - `socket:auth-failed` (window event from lib/socket) -> token rejected;
 *   stop, clear, redirect to /login like the HTTP 401 path.
 */
export function useRealtime({ enableToasts = true } = {}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    // No token (or unresolvable URL): stay on HTTP polling, never crash.
    if (!socket) return undefined;

    // Prefix match (exact: false): ["employees"] covers both the roster list
    // (["employees", params]) and the stat cards (["employees", "overview"]),
    // so an employee's expense save refreshes issued / spent / remaining /
    // progressbar / % on AdminEmployees -> EmployeesTable with no refresh.
    // refetchType "active" refetches mounted views immediately.
    const invalidateMoney = () => {
      for (const key of MONEY_KEYS) {
        qc.invalidateQueries({
          queryKey: key,
          exact: false,
          refetchType: "active",
        });
      }
    };
    // Coalesce bursts (e.g. settle N rows emits once, but double-fire safe).
    let t = null;
    const invalidateSoon = () => {
      clearTimeout(t);
      t = setTimeout(invalidateMoney, 150);
    };

    // Actor-only toasts: your own saves already toasted from their mutation
    // handlers, so someone else's write must NEVER pop a toast here — just
    // refresh silently via invalidateSoon() above.
    const onChanged = (payload) => {
      if (!isValidPayload(payload)) return;
      invalidateSoon();
    };

    const onBalance = (payload) => {
      if (payload !== undefined && !isValidPayload(payload)) return;
      invalidateSoon();
    };

    // Actor-only toasts: the employee already toasted on their own device,
    // so the admin radar stays silent too — just refresh via invalidateSoon().
    const onEmployeeActivity = (payload) => {
      if (!isValidPayload(payload)) return;
      invalidateSoon();
    };

    const onForceLogout = (payload = {}) => {
      const reason = safeText(payload.reason, 200);
      toast.error(reason || "Your session was ended by an administrator.", {
        id: "force-logout",
        duration: 6000,
      });
      setTimeout(() => {
        window.location.assign("/login");
      }, 1200);
    };

    const onForceReconnect = () => {
      // Server dropped the transport at JWT expiry. Re-assert with the stored
      // token (connectSocket refreshes `auth`); if the token itself is dead
      // the connect_error path below takes over and redirects.
      try {
        connectSocket();
      } catch {
        // best-effort
      }
    };

    const onAuthFailed = () => {
      toast.error("Session expired. Please sign in again.", {
        id: "socket-auth-failed",
        duration: 5000,
      });
      setTimeout(() => {
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
      }, 800);
    };

    const onConnect = () => {
      try {
        socket.emit("transactions:join");
      } catch {
        // best-effort
      }
    };

    socket.on("transactions:changed", onChanged);
    socket.on("balance:changed", onBalance);
    socket.on("employee:activity", onEmployeeActivity);
    socket.on("force:logout", onForceLogout);
    socket.on("force:reconnect", onForceReconnect);
    socket.on("connect", onConnect);
    window.addEventListener("socket:auth-failed", onAuthFailed);
    if (socket.connected) {
      try {
        socket.emit("transactions:join");
      } catch {
        // best-effort
      }
    }

    return () => {
      clearTimeout(t);
      try {
        socket.off("transactions:changed", onChanged);
        socket.off("balance:changed", onBalance);
        socket.off("employee:activity", onEmployeeActivity);
        socket.off("force:logout", onForceLogout);
        socket.off("force:reconnect", onForceReconnect);
        socket.off("connect", onConnect);
      } catch {
        // best-effort
      }
      window.removeEventListener("socket:auth-failed", onAuthFailed);
    };
  }, [user, qc, enableToasts]);
}

/** Connection indicator state: "connected" | "connecting" | "disconnected". */
export function useSocketStatus() {
  const { user } = useAuth();
  const [, setTick] = useState(0);
  useEffect(() => {
    // Never create the singleton for a logged-out view — status is plainly
    // "disconnected" and no transport is opened.
    if (!user) return undefined;
    let socket = null;
    try {
      socket = getSocket();
    } catch {
      return undefined;
    }
    const bump = () => setTick((n) => n + 1);
    socket.on("connect", bump);
    socket.on("disconnect", bump);
    return () => {
      try {
        socket.off("connect", bump);
        socket.off("disconnect", bump);
      } catch {
        // best-effort
      }
    };
  }, [user]);
  if (!user) return "disconnected";
  try {
    const s = getSocket();
    if (s.connected) return "connected";
    if (s.active) return "connecting";
  } catch {
    // unresolvable URL / no token yet
  }
  return "disconnected";
}

export default useRealtime;
