import { apiClient } from "./client";
import { getGeminiModel } from "../lib/geminiModel";

const modelHeaders = () => ({ "X-Gemini-Model": getGeminiModel() });

export const aiApi = {
  receiptParse: (file) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post("/ai/receipt-parse", form, {
        headers: { "Content-Type": "multipart/form-data", ...modelHeaders() },
      })
      .then((r) => r.data.data);
  },
  suggestExpenses: (payload) =>
    apiClient
      .post("/ai/expense-suggest", payload, { headers: modelHeaders() })
      .then((r) => r.data.data),
};