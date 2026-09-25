// Helpers for the receipt media stored on `expenses.image_url`.
//
// Scans are stored server-side and referenced as plain URLs
// (`/api/uploads/receipts/<file>`), but drafts parked before that change can
// still hold a base64 data URL — both shapes must preview and open correctly.

/** True when the stored receipt is a PDF (by URL or by original file name). */
export const isReceiptPdf = (url, fileName = "") =>
  /\.pdf(\?.*)?$/i.test(String(url ?? "")) ||
  /\.pdf$/i.test(String(fileName ?? ""));

/**
 * Opens a stored receipt in a fresh tab. Plain URLs go straight through. A
 * data URL (legacy draft) is converted to a Blob URL first — Chrome refuses
 * top-level navigation to `data:` URLs — and revoked once the tab has had time
 * to load it.
 */
export const openReceiptFile = (url) => {
  if (!url) return;

  if (!url.startsWith("data:")) {
    window.open(url, "_blank", "noopener");
    return;
  }

  try {
    const [meta, base64] = url.split(",");
    if (!base64) throw new Error("not a data url");

    const mime = /:(.*?);/.exec(meta)?.[1] || "image/png";
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) {
      buffer[i] = bytes.charCodeAt(i);
    }

    const blobUrl = URL.createObjectURL(new Blob([buffer], { type: mime }));
    window.open(blobUrl, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
};
