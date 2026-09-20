// Second AI pass over a confirmed scan: asks /ai/expense-suggest to turn the
// receipt's whole scan list (plus vendor and date) into ONE readable expense
// description and the best-fit category from the ones the admin already has.
// Mirrors `useReceiptScan`: one busy flag, one error string, and a normalizer
// that keeps a malformed reply from crashing the form.
import { useCallback, useState } from "react";
import { aiApi } from "../api/ai";

// Payload guard matching the backend zod validator (ai.validation.js) so a
// half-filled line can't 400 the whole request.
const toRequestItems = (items = []) =>
  items.map((item) => ({
    description: String(item?.description ?? "").trim(),
    quantity: Number(item?.quantity) || 0,
    rate: Number(item?.rate) || 0,
    amount: Number(item?.amount) || 0,
  }));

// Gemini can answer with an odd shape — keep only usable strings, and return
// null when it suggested nothing at all so the caller can skip the update.
const normalizeSuggestion = (res) => {
  const description =
    typeof res?.description === "string" ? res.description.trim() : "";
  const category = typeof res?.category === "string" ? res.category.trim() : "";

  return description || category ? { description, category } : null;
};

export const useExpenseSuggestion = ({ onError } = {}) => {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const suggest = useCallback(
    async ({ vendor, date, items, categories } = {}) => {
      const requestItems = toRequestItems(items);
      if (!requestItems.length) return null;

      setErr("");
      setLoading(true);
      try {
        const res = await aiApi.suggestExpenses({
          vendor: vendor || "",
          date: date || "",
          items: requestItems,
          categories: (categories ?? []).filter(Boolean),
        });

        return normalizeSuggestion(res);
      } catch (ex) {
        const message = ex?.message || "Couldn't analyze the receipt items.";
        setErr(message);
        onError?.(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  return { loading, err, setErr, suggest };
};
