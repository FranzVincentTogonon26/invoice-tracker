// Shared scan engine: validates the picked file (type + the shared size gate,
// kept in sync with the backend upload middleware), POSTs it to
// /ai/receipt-parse and hands the normalized result to `onParsed` (or the
// message to `onError`). Used by the modal's dropzone (auto-scan on upload)
// and the manual scan icon.
//
// PARSE ONLY: the backend reads the upload from memory and never stores it, so
// nothing reaches `uploads/receipts` during a scan. The picked File is kept in
// the browser (`lib/receiptFiles.js`) and every held file is uploaded at once
// when the Add Expenses form is saved — see `POST /expenses/receipt-images`.
import { useCallback, useRef, useState } from "react";
import { aiApi } from "../api/ai";
import { useAuth } from "../context/AuthContext";
import {
  MAX_RECEIPT_BYTES,
  MAX_RECEIPT_LABEL,
  USER_ROLES,
} from "../constants";

const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);

// Client-side normalizer matching the backend zod validator
// (geminiService.js). Keeps a malformed AI response from crashing the modal
// with undefined fields. (Zod isn't a frontend dependency, so this is plain
// JS instead of a schema.)
const normalizeParsedReceipt = (res) => {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

  const lineItems = (Array.isArray(res?.lineItems) ? res.lineItems : [])
    .map((li) => ({
      description: str(li?.description),
      quantity: num(li?.quantity, 1) || 1,
      rate: num(li?.rate, 0),
    }))
    .filter((li) => li.description || li.rate > 0);

  return {
    vendor: str(res?.vendor),
    receipt_date: str(res?.receipt_date),
    currency: str(res?.currency),
    lineItems,
    subtotal: num(res?.subtotal, 0),
    total: num(res?.total, 0),
    suggested_category: str(res?.suggested_category),
    // Empty in the deferred-upload flow (the scan stores nothing); kept for
    // any response that still carries an already-stored URL.
    imageUrl: str(res?.image_url),
    fileName: str(res?.file_name),
  };
};

// Scan gate mirrored from the backend's authMiddleware on
// POST /ai/receipt-parse: that route requires a real users row (user_id
// exists) with status "active" and carries NO requireAdminAccess step, so an
// admin and an employee scan alike. Checked up front for instant feedback
// instead of a late 401/403 from the API.
const canScan = (user) =>
  Boolean(user?.user_id) &&
  user?.status === "active" &&
  (user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.EMPLOYEE);

export const useReceiptScan = ({ onParsed, onError }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const busyRef = useRef(false);

  const scanFile = useCallback(
    async (file) => {
      if (!file || busyRef.current) return false;
      if (!canScan(user)) {
        const message =
          "Only active admin and employee accounts can scan receipts.";
        setErr(message);
        onError?.(message);
        return false;
      }
      if (!ACCEPTED_MIME.has(file.type)) {
        const message = "Upload a PNG, JPG, WEBP or PDF receipt.";
        setErr(message);
        onError?.(message);
        return false;
      }
      if (file.size > MAX_RECEIPT_BYTES) {
        const message = `Receipt must be ${MAX_RECEIPT_LABEL} or smaller.`;
        setErr(message);
        onError?.(message);
        return false;
      }

      setErr("");
      setLoading(true);
      busyRef.current = true;
      try {
        const res = await aiApi.receiptParse(file);
        const parsed = normalizeParsedReceipt(res);
        if (!parsed.lineItems.length && !parsed.total) {
          throw new Error(
            "No receipt data found. Try a clearer photo of the receipt.",
          );
        }
        onParsed?.(parsed);
        return true;
      } catch (ex) {
        const message = ex?.message || "Couldn't read receipt";
        setErr(message);
        onError?.(message);
        return false;
      } finally {
        busyRef.current = false;
        setLoading(false);
      }
    },
    [user, onParsed, onError],
  );

  return { loading, err, setErr, scanFile };
};
