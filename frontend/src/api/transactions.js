import { apiClient } from "./client";

export const transactionsApi = {
  list: (params = {}) =>
    apiClient.get("/transactions", { params }).then((r) => r.data),
};
