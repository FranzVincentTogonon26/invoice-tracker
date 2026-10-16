import { formatDate, formatMoney } from "@/lib/utils";

// ── Report exports (AdminReports) ─────────────────────────────────────
// CSV download + self-contained print document. No third-party deps — the
// print builder mirrors ReimbursementPreviewModal's window.open pattern
// (inline styles only, no app CSS leaking in).

const escCsv = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// columns: [{ key, label }] — rows: plain objects. Triggers a download.
export function downloadCSV(filename, columns, rows) {
  const header = columns.map((c) => escCsv(c.label)).join(",");
  const body = (rows ?? []).map((row) =>
    columns.map((c) => escCsv(row?.[c.key])).join(","),
  );
  const blob = new Blob([[header, ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Opens a clean black-on-white report document and its print dialog.
// summaryRows: [[label, value]] · table: { columns: [labels], rows: [[cells]] }.
// Resolves false when the popup is blocked.
export function openPrintDocument({ title, subtitle, summaryRows, table }) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;
  const summary = (summaryRows ?? [])
    .map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`)
    .join("");
  const head = (table?.columns ?? [])
    .map((c) => `<th>${escHtml(c)}</th>`)
    .join("");
  const body =
    (table?.rows ?? [])
      .map(
        (cells) =>
          `<tr>${cells.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`,
      )
      .join("") ||
    `<tr><td colspan="${Math.max(1, (table?.columns ?? []).length)}">No records in this report.</td></tr>`;
  win.document.write(`<!doctype html>
<html><head><title>${escHtml(title)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin: 0; } .sub { color: #666; font-size: 12px; margin: 4px 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; text-transform: uppercase; font-size: 11px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .money td:first-child { color: #555; } .money td:last-child { text-align: right; font-weight: 600; }
  h2 { font-size: 14px; margin: 20px 0 4px; }
</style></head><body>
  <h1>${escHtml(title)}</h1>
  <p class="sub">${escHtml(subtitle ?? "")}</p>
  <h2>Summary</h2>
  <table class="money">${summary}</table>
  <h2>Records (${(table?.rows ?? []).length})</h2>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}

// Shared money/row formatters so the page, preview modal, print doc and
// CSV all render the same values.
export const reportHelpers = {
  dateLabel: (iso) => formatDate(iso),
  money: (n) => formatMoney(n),
};
