import { apiClient } from "./client";

export const sourceOfFundsApi = {

  list: (params = {}) => apiClient.get("/source-of-funds", { params }).then((r) => r.data),

};
