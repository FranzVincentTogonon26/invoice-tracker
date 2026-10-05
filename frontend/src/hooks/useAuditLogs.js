import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "../api/auditLogs";

export const auditLogsKey = (params) => ["auditLogs", params || {}];

// Admin audit trail (`backend/logs/transactions.md`, newest first).
// Nests under ["auditLogs", …] and that root is part of the realtime
// MONEY_KEYS, so every socket money event refetches the visible page with
// no manual refresh.
export function useAuditLogs(params) {
  const query = useQuery({
    queryKey: auditLogsKey(params),
    queryFn: () => auditLogsApi.list(params),
  });

  return {
    ...query,
    logs: query.data?.logs ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    limit: query.data?.limit ?? 50,
    pageCount: query.data?.pageCount ?? 1,
    stats: query.data?.stats ?? {
      total: 0,
      today: 0,
      byAction: {},
      byEntity: {},
      byRole: { admin: 0, employee: 0, unknown: 0 },
    },
    facets: query.data?.facets ?? { actions: [], entities: [] },
  };
}
