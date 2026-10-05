import { apiClient } from "./client";

export const auditLogsApi = {
  // Admin audit trail sourced from `backend/logs/transactions.md`
  // (newest first). `params` carries the optional `from` / `to`
  // (YYYY-MM-DD), `action`, `entity`, `role`, `actor`, `search`,
  // `page`, `limit` filters.
  list: (params = {}) =>
    apiClient.get("/audit-logs", { params }).then((r) => r.data),
};
