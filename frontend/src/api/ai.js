import { apiClient } from "./client";

export const aiApi = {
  // POST /ai/receipt-parse → { data: { vendor, receipt_date, currency,
  // lineItems, subtotal, total, suggested_category } } — the controller
  // wraps the parsed receipt in `data`, not `result`.
  receiptParse: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post("/ai/receipt-parse", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.data);
  },

  // POST /ai/expense-suggest → { data: { description, category } } — text-only
  // second pass over a confirmed scan: analyzes the receipt's whole scan list
  // into ONE expense description and picks the best-fit category from the ones
  // the admin already has (empty string when nothing fits).
  suggestExpenses: (payload) =>
    apiClient.post("/ai/expense-suggest", payload).then((r) => r.data.data),
};

