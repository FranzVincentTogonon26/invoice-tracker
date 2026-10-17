import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Download, FileText, Printer, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { formatMoney } from "@/lib/utils";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// Read-only report preview: the exact summary + rows the print document
// and CSV export carry, so what you see is what you get. Print/CSV fire
// through the callbacks the page wires up. An optional `chart` node renders
// between the summary and the records table for reports that chart well.
export function ReportPreviewModal({
  open,
  onClose,
  title,
  subtitle,
  summaryRows = [],
  columns = [],
  rows = [],
  totalOut,
  totalOutLabel = "total out",
  chart = null,
  onPrint,
  onDownloadCSV,
}) {
  // Escape closes the preview — capture phase so the shortcut can never
  // leak to whatever sits behind the dialog.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose?.();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="report-preview"
          className="scrollbar-slim fixed inset-0 z-[70] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="flex min-h-full p-4">
            <motion.div
              className="fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
              onClick={onClose}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: DIALOG_EASE }}
              className="relative m-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover outline-none"
            >
              <div className="flex shrink-0 items-center gap-3 p-5 sm:px-6">
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                >
                  <FileText size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                    {title}
                  </p>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
                    {subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close report preview"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
                >
                  <X size={16} aria-hidden />
                </button>
              </div>

              <div className="scrollbar-slim min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-2 sm:px-6">
                <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
                  <table className="w-full border-collapse text-sm">
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {summaryRows.map(([label, value]) => (
                        <tr
                          key={label}
                          className="bg-[var(--surface-2)]/40"
                        >
                          <td className="px-4 py-2.5 text-xs text-[var(--ink-muted)]">
                            {label}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--ink)]">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {chart ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-4 sm:p-5">
                    {chart}
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                    <thead className="bg-[var(--surface-2)]">
                      <tr>
                        {columns.map((c) => (
                          <th
                            key={c}
                            scope="col"
                            className="whitespace-nowrap border-b border-[var(--border)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-muted)]"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]/60">
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(1, columns.length)}
                            className="px-4 py-6 text-center text-xs text-[var(--ink-muted)]"
                          >
                            No records in this report.
                          </td>
                        </tr>
                      ) : (
                        rows.map((cells, i) => (
                          <tr key={i}>
                            {cells.map((cell, j) => (
                              <td
                                key={j}
                                className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[var(--ink)]"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs tabular-nums text-[var(--ink-muted)]">
                  {rows.length} {rows.length === 1 ? "record" : "records"}
                  {totalOut != null ? (
                    <>
                      {" · "}
                      {formatMoney(totalOut)} {totalOutLabel}
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] p-5 sm:px-6">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button type="button" variant="soft" onClick={onDownloadCSV}>
                  <Download size={14} aria-hidden />
                  Download CSV
                </Button>
                <Button type="button" variant="accent" onClick={onPrint}>
                  <Printer size={14} aria-hidden />
                  Print report
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default ReportPreviewModal;
