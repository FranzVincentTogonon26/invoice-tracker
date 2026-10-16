import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Printer, X } from "lucide-react";
import { Badge } from "../../../ui/Badge";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { formatDate, formatMoney, formatTime } from "@/lib/utils";
import { STATUS } from "../../../../constants";

// Read-only summary of one issuance record: identity, money tiles, expense
// list and finalization note. Pure presentational — data arrives via props.
export function ReimbursementPreviewModal({
  open,
  onClose,
  row,
  labels = [],
  finalizedDate,
  recordNote,
  txns = [],
  txLoading = false,
}) {
  // Newest first — memoized so the list never reshuffles mid-render.
  const sorted = useMemo(
    () =>
      [...(txns ?? [])].sort(
        (a, b) => new Date(b.expense_date) - new Date(a.expense_date),
      ),
    [txns],
  );

  // Print action — renders a clean black-on-white summary document in a new
  // window (self-contained inline styles, no app CSS leaking in) and opens
  // the browser print dialog there.
  const handlePrint = () => {
    const esc = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const moneyRows = [
      ["Issued budget", formatMoney(row?.issued ?? 0)],
      ["Open abono", formatMoney(row?.openAbono ?? 0)],
      ["Total spent", formatMoney(row?.spent ?? 0)],
      ["Sent transfers", formatMoney(row?.sent ?? 0)],
      ["Received transfers", formatMoney(row?.received ?? 0)],
      ["Settled abono", formatMoney(row?.settledAbono ?? 0)],
      ["Remaining balance", formatMoney(row?.balance ?? 0)],
    ];
    const expenseRows = sorted
      .map(
        (e) => `<tr>
          <td>${esc(e.description) || "Untitled"}</td>
          <td>${esc(e.category_name) || "—"}</td>
          <td>${esc(formatDate(e.expense_date))}</td>
          <td>${esc((STATUS[e.status] ?? {}).label ?? e.status ?? "—")}</td>
          <td class="num">${esc(formatMoney(e.total_amount))}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!doctype html>
<html><head><title>Reimbursement — ${esc(row?.name || "record")}</title>
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
  <h1>Reimbursement Preview</h1>
  <p class="sub">${esc(row?.name || "—")}${row?.email ? ` · ${esc(row.email)}` : ""}${labels[0] ? ` · ${esc(labels[0])}` : ""}${
    finalizedDate ? ` · Finalized ${esc(formatDate(finalizedDate))}` : ""
  }</p>
  <h2>Money summary</h2>
  <table class="money">${moneyRows
    .map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`)
    .join("")}</table>
  <h2>Expense transactions (${sorted.length})</h2>
  <table><thead><tr><th>Description</th><th>Category</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead>
  <tbody>${expenseRows || '<tr><td colspan="5">No expense transactions.</td></tr>'}</tbody></table>
  ${recordNote ? `<p class="sub">Note: ${esc(recordNote)}</p>` : ""}
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="reimbursement-preview"
          // Overlay scrolls so the scrollbar sits outside the modal (same
          // pattern as ExpenseDetailsModal) — `m-auto` centers the dialog
          // when it fits and keeps long content fully scrollable.
          className="scrollbar-slim fixed inset-0 z-[70] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex min-h-full p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={() => onClose?.()}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Reimbursement preview"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative m-auto w-full max-w-4xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover"
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <Eye size={18} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-medium tracking-tight text-[var(--ink)]">
                  Reimbursement Preview
                </h3>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  Full summary of this issuance record
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                aria-label="Print preview"
                title="Print preview"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <Printer size={15} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onClose?.()}
                aria-label="Close preview"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* ── Identity card ── */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
                <EmployeeAvatar
                  name={row?.name}
                  avatarUrl={row?.avatarUrl}
                  className="h-11 w-11 shrink-0 text-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                    {row?.name || "—"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                    {row?.email || "No email on file"}
                  </p>
                </div>
                <div className="flex w-full flex-row items-center gap-1.5 sm:w-auto sm:max-w-[320px] sm:shrink-0">
                  {(finalizedDate || recordNote) && (
                    <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-0.5">
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-[var(--ink-muted)]">
                        {finalizedDate
                          ? `Finalized on ${formatDate(finalizedDate)}.`
                          : ""}
                      </p>
                    </div>
                  )}
                  {labels[0] && (
                    <Badge
                      tone="neutral"
                      className="max-w-[160px] shrink-0 truncate text-xs"
                    >
                      {labels[0]}
                    </Badge>
                  )}
                </div>
              </div>

              {/* ── Money stat cards ── */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Issued",
                    value: formatMoney(row?.issued ?? 0),
                    tone: "accent",
                    lines: [
                      Number(row?.received) > 0 && {
                        text: `+ ${formatMoney(row.received)}`,
                        title: `${formatMoney(row.received)} received from budget transfers`,
                        className: "text-[var(--accent-strong)]",
                      },
                      Number(row?.sent) > 0 && {
                        text: `- ${formatMoney(row.sent)}`,
                        title: `${formatMoney(row.sent)} sent via budget transfers`,
                        className: "text-[var(--danger)]",
                      },

                    ].filter(Boolean),
                  },
                  {
                    label: "Open Abono",
                    value: formatMoney(row?.openAbono ?? 0),
                    hint: `${row?.openAbonoCount ?? 0} records`,
                    tone: Number(row?.openAbono) > 0 ? "warning" : "neutral",
                    lines: [],
                  },
                  {
                    label: "Total Spent",
                    value: formatMoney(row?.spent ?? 0),
                    hint: `${row?.expenseCount ?? 0} expenses`,
                    tone: "neutral",
                    lines: [
                      Number(row?.sent) > 0 && {
                        title: `${formatMoney(row.sent)} sent via budget transfers`,
                        className: "text-[var(--danger)]",
                      },
                    ].filter(Boolean),
                  },
                  {
                    label: "Balance",
                    value: formatMoney(row?.balance ?? 0),
                    hint: "Remaining",
                    tone: Number(row?.balance) < 0 ? "danger" : "neutral",
                    lines: [],
                  },
                ].map(({ label, value, hint, tone, lines }) => (
                  <div
                    key={label}
                    className="flex flex-col gap-1.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center shadow-card"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]">
                      {label}
                    </p>
                    <p
                      className={[
                        "font-display text-base font-semibold tabular-nums leading-none",
                        tone === "accent"
                          ? "text-[var(--accent-strong)]"
                          : tone === "warning"
                            ? "text-[var(--warning)]"
                            : tone === "danger"
                              ? "text-[var(--danger)]"
                              : "text-[var(--ink)]",
                      ].join(" ")}
                    >
                      {value}
                    </p>
                    {lines.map((line) => (
                      <p
                        key={line.text}
                        title={line.title}
                        className={`text-[11px] font-medium tabular-nums ${line.className}`}
                      >
                        {line.text}
                      </p>
                    ))}
                    <p className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                      {hint}
                    </p>
                  </div>
                ))}
              </div>

              {/* ── Expense transactions table ── */}
              <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                {/* table header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                    Expense Transactions
                  </p>
                  <span className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                    {sorted.length} {sorted.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                {txLoading ? (
                  <div className="space-y-px">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-[var(--surface)] px-4 py-3"
                      >
                        <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--border)]" />
                        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-[var(--border)]" />
                      </div>
                    ))}
                  </div>
                ) : sorted.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-[var(--ink-muted)]">
                    No expense transactions for this record.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]/40">
                        <th
                          scope="col"
                          className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]"
                        >
                          Description
                        </th>
                        <th
                          scope="col"
                          className="hidden px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] sm:table-cell"
                        >
                          Category
                        </th>
                        <th
                          scope="col"
                          className="hidden px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)] md:table-cell"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]"
                        >
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {sorted.map((e) => {
                        const isCancelled = e.status === "cancel";
                        const isFlagged = Number(e.flag) === 1;
                        const meta = STATUS[e.status] ?? {
                          tone: "neutral",
                          label: e.status ?? "—",
                        };
                        const toneClass =
                          {
                            success:
                              "bg-[var(--success)]/10 text-[var(--success)]",
                            danger:
                              "bg-[var(--danger)]/10 text-[var(--danger)]",
                            warning:
                              "bg-[var(--warning)]/10 text-[var(--warning)]",
                            accent:
                              "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
                            neutral:
                              "bg-[var(--surface-2)] text-[var(--ink-muted)]",
                          }[meta.tone] ??
                          "bg-[var(--surface-2)] text-[var(--ink-muted)]";
                        return (
                          <tr
                            key={e.id}
                            className={[
                              "transition-colors hover:bg-[var(--surface-2)]/40",
                              isCancelled
                                ? "bg-[var(--danger)]/[0.03]"
                                : "bg-[var(--surface)]",
                            ].join(" ")}
                          >
                            {/* Description + flag */}
                            <td className="max-w-[160px] px-4 py-2.5">
                              <p
                                className={[
                                  "truncate text-sm font-medium",
                                  isCancelled
                                    ? "text-[var(--ink-muted)] line-through"
                                    : "text-[var(--ink)]",
                                ].join(" ")}
                                title={e.description}
                              >
                                {e.description || "Untitled"}
                              </p>
                              {isFlagged && (
                                <span className="mt-0.5 inline-block rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wide bg-[var(--danger)]/10 text-[var(--danger)]">
                                  Flagged
                                </span>
                              )}
                            </td>
                            {/* Category */}
                            <td className="hidden max-w-[120px] px-4 py-2.5 sm:table-cell">
                              <span className="truncate text-xs text-[var(--ink-muted)]">
                                {e.category_name || "—"}
                              </span>
                            </td>
                            {/* Date */}
                            <td className="hidden whitespace-nowrap px-4 py-2.5 md:table-cell">
                              <p className="text-xs tabular-nums text-[var(--ink)]">
                                {formatDate(e.expense_date)}
                              </p>
                              <p className="text-[11px] tabular-nums text-[var(--ink-muted)]">
                                {formatTime(e.expense_date)}
                              </p>
                            </td>
                            {/* Status badge */}
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={[
                                  "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  toneClass,
                                ].join(" ")}
                              >
                                {meta.label}
                              </span>
                            </td>
                            {/* Amount */}
                            <td className="whitespace-nowrap px-4 py-2.5 text-right">
                              <span
                                className={[
                                  "text-sm font-semibold tabular-nums",
                                  isCancelled
                                    ? "text-[var(--ink-muted)] line-through"
                                    : "text-[var(--ink)]",
                                ].join(" ")}
                              >
                                {formatMoney(e.total_amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Totals footer */}
                    <tfoot>
                      <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]/60">
                        <td
                          colSpan={3}
                          className="hidden px-4 py-2.5 text-xs font-medium text-[var(--ink-muted)] md:table-cell"
                        >
                          {sorted.filter((e) => e.status !== "cancel").length}{" "}
                          active ·{" "}
                          {sorted.filter((e) => e.status === "cancel").length}{" "}
                          cancelled
                        </td>
                        <td
                          colSpan={3}
                          className="px-4 py-2.5 text-right text-lg font-semibold tabular-nums text-[var(--ink)] md:col-span-2"
                        >
                          Total:{" "}
                          {formatMoney(
                            sorted
                              .filter((e) => e.status !== "cancel")
                              .reduce(
                                (sum, e) => sum + (Number(e.total_amount) || 0),
                                0,
                              ),
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ReimbursementPreviewModal;
