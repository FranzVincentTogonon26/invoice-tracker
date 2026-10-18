import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarOff,
  CalendarX2,
  ClipboardList,
  Eye,
  HandCoins,
  PhilippinePeso,
  Printer,
  ReceiptText,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import Listbox from "../../../ui/Listbox";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { TRANSACTION_KIND_META } from "@/constants";
import { matchesTypeTab } from "@/lib/transactionLedger";
import { StatusBadge } from "./SourceBadges";

const DIALOG_EASE = [0.16, 1, 0.3, 1];

// Icon tile tones per ledger kind — mirrors the Badge tone vocabulary so the
// preview reads the same colors as the ledger tables.
const KIND_TILE_TONES = {
  accent: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
  success: "bg-[var(--success)]/12 text-[var(--success)]",
  warning: "bg-[var(--warning)]/12 text-[var(--warning)]",
  danger: "bg-[var(--danger)]/12 text-[var(--danger)]",
  neutral: "bg-[var(--surface-2)] text-[var(--ink-muted)]",
};

// Pill coloring for the active-type chip beside the section title — one
// text/tint/ring trio per badge tone.
const KIND_PILL_TONES = {
  accent:
    "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[var(--accent)]/25",
  success:
    "bg-[var(--success)]/12 text-[var(--success)] ring-[var(--success)]/25",
  warning:
    "bg-[var(--warning)]/15 text-[var(--warning)] ring-[var(--warning)]/30",
  danger: "bg-[var(--danger)]/12 text-[var(--danger)] ring-[var(--danger)]/30",
  neutral:
    "bg-[var(--surface-2)] text-[var(--ink-muted)] ring-[var(--border)]",
};

/** Compact headline card — one figure with label and subtext. */
function StatTile({
  label,
  value,
  subtext,
  Icon,
  accent = false,
  isDanger = false,
  className,
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-3.5 py-3 transition-colors",
        accent
          ? "border-[var(--accent)]/30 bg-[var(--accent-soft)]/40"
          : isDanger
            ? "border-[var(--danger)]/30 bg-[var(--danger)]/8"
            : "border-[var(--border)] bg-[var(--surface-2)]/60",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 type-eyebrow",
          accent
            ? "text-[var(--accent-strong)]"
            : isDanger
              ? "text-[var(--danger)]"
              : "text-[var(--ink-muted)]",
        )}
      >
        {Icon ? <Icon size={12} aria-hidden className="shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-1.5 truncate font-display text-lg font-semibold tracking-tight tabular-nums",
          isDanger ? "text-[var(--danger)]" : "text-[var(--ink)]",
        )}
      >
        {value}
      </p>
      {subtext ? (
        <p
          className={cn(
            "mt-0.5 truncate text-[11px]",
            isDanger ? "text-[var(--danger)]/90" : "text-[var(--ink-muted)]",
          )}
        >
          {subtext}
        </p>
      ) : null}
    </div>
  );
}

/**
 * SourcePreviewModal
 * Read-only “Preview Budget Source” report opened from the overview header —
 * headline stat cards, the people involved, the cut-off schedule and the
 * transaction ledger. The type tabs (flow direction plus every transaction
 * type present: Expenses, Abono, Budget Issued, …) narrow the list, and the
 * header printer button hands the dialog to the browser; the print styles in
 * index.css strip the app chrome and lay the report out on paper exactly as
 * filtered, with a label telling the paper which type is being shown.
 */
export default function SourcePreviewModal({
  open,
  source,
  rows = [],
  isClosed = false,
  allocated = 0,
  remaining = 0,
  issued = 0,
  spentTotal = 0,
  budgetsCount = 0,
  hasCutOff = false,
  cutOffDue = false,
  cutOffToday = false,
  onClose,
}) {
  const titleId = useId();
  // "all" | "in" | "out" (flow direction) | a TRANSACTION_KIND_META kind
  const [typeFilter, setTypeFilter] = useState("all");

  // Reset the type filter whenever the modal opens or the active source
  // switches. Render-time adjustment (same pattern as
  // TransactionDetailsModal) — an effect would add a cascading render and the
  // react-hooks lint bans setState inside effects.
  const viewKey = open ? (source?.reference_id ?? null) : null;
  const [prevView, setPrevView] = useState(null);
  if (prevView !== viewKey) {
    setPrevView(viewKey);
    setTypeFilter("all");
  }

  // Lock body scroll while the modal is open, mark the body for the print
  // styles and wire up the Escape key. The listener sits in the BUBBLE phase:
  // an open Listbox consumes its Escape first (it stops propagation), so the
  // first press closes the dropdown and only the next one closes the modal.
  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("source-preview-open");

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove("source-preview-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Newest first — a report reads top-down, not in insertion order.
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0)),
    [rows],
  );

  // The transaction types actually present in this source, in the canonical
  // order of TRANSACTION_KIND_META — the picker offers exactly what can appear.
  const kindOptions = useMemo(() => {
    const present = new Set(
      sortedRows.map((row) => row.kind).filter(Boolean),
    );
    return Object.entries(TRANSACTION_KIND_META)
      .filter(([kind]) => present.has(kind))
      .map(([kind, meta]) => ({ value: kind, label: meta.label }));
  }, [sortedRows]);

  // Options for the type Listbox — the direction presets plus every
  // transaction type present in this source.
  const typeOptions = useMemo(
    () => [
      { value: "all", label: "All types" },
      { value: "in", label: "Incoming" },
      { value: "out", label: "Outgoing" },
      ...kindOptions.map(({ value, label }) => ({ value, label })),
    ],
    [kindOptions],
  );

  // Rows the view currently shows — the type tabs. The printed report renders
  // this same list, so what you see is what prints.
  const filteredRows = useMemo(() => {
    if (typeFilter === "all") return sortedRows;
    if (typeFilter === "in" || typeFilter === "out") {
      return sortedRows.filter((row) => row.direction === typeFilter);
    }
    return sortedRows.filter((row) => matchesTypeTab(row, typeFilter));
  }, [sortedRows, typeFilter]);

  // Descriptor for the active tab — drives the “… only” pill beside the
  // section title, which also lands in the printed report.
  const activeType = useMemo(() => {
    if (typeFilter === "all") return null;
    if (typeFilter === "in") {
      return { label: "Incoming only", Icon: ArrowDownLeft, tone: "success" };
    }
    if (typeFilter === "out") {
      return { label: "Outgoing only", Icon: ArrowUpRight, tone: "danger" };
    }
    const meta = TRANSACTION_KIND_META[typeFilter];
    return {
      label: `${meta?.label ?? typeFilter} only`,
      Icon: meta?.Icon ?? ReceiptText,
      tone: meta?.tone ?? "neutral",
    };
  }, [typeFilter]);
  const ActiveTypeIcon = activeType?.Icon ?? ReceiptText;

  const involved = Array.isArray(source?.involved) ? source.involved : [];
  const involvedCount = Number(source?.involved_count) || involved.length;
  const remainingPct =
    allocated > 0
      ? Math.max(0, Math.min(100, (remaining / allocated) * 100))
      : 0;
  const issuedPct = allocated > 0 ? (issued / allocated) * 100 : 0;
  const isOverdrawn = remaining < 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && source && (
        <motion.div
          key="source-preview-container"
          className="source-preview-overlay fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {/* Backdrop */}
          <motion.div
            key="source-preview-backdrop"
            className="source-preview-backdrop fixed inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          />

          {/* Dialog Panel */}
          <motion.div
            key="source-preview-panel"
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: DIALOG_EASE }}
            className="source-preview-dialog relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-hover outline-none"
          >
            {/* ── Dialog Header (Pinned) ── */}
            <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    aria-hidden
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-xs ring-1 ring-[var(--accent)]/20"
                  >
                    <Eye size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="type-eyebrow text-[var(--ink-muted)]">
                        Preview Budget Source
                      </p>
                    </div>
                    <h2
                      id={titleId}
                      className="mt-0.5 truncate font-display text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl"
                    >
                      {source.label || "Untitled source"}
                    </h2>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    aria-label="Print source report"
                    title="Print report"
                    className="source-preview-no-print flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 active:scale-95"
                  >
                    <Printer size={16} aria-hidden />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close source preview"
                    className="source-preview-no-print flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 active:scale-95"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </div>

              {/* Status, created on, cut-off schedule */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={source.status} />

                {source.created_at && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-medium tabular-nums text-[var(--ink)] ring-1 ring-inset ring-[var(--border)]">
                    <CalendarDays
                      size={12}
                      aria-hidden
                      className="shrink-0 text-[var(--ink-muted)]"
                    />
                    Created {formatDate(source.created_at)}
                  </span>
                )}

                {isClosed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--danger)]/12 px-2.5 py-1 font-semibold tabular-nums text-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]/30">
                    <CalendarX2 size={12} aria-hidden className="shrink-0" />
                    Source Closed{" "}
                    {source.date_cut_off
                      ? `· ${formatDate(source.date_cut_off)}`
                      : ""}
                  </span>
                ) : hasCutOff && source.date_cut_off ? (
                  <span
                    title={
                      cutOffDue
                        ? `Cut-off date already due — this source accepts no new activity since ${formatDate(source.date_cut_off)}`
                        : cutOffToday
                          ? "Today is the due date — this source stops accepting activity after today"
                          : `This source stops accepting activity on ${formatDate(source.date_cut_off)}`
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold tabular-nums ring-1 ring-inset",
                      cutOffDue
                        ? "bg-[var(--danger)]/12 text-[var(--danger)] ring-[var(--danger)]/30"
                        : cutOffToday
                          ? "bg-[var(--warning)]/15 text-[var(--warning)] ring-[var(--warning)]/30"
                          : "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[var(--accent)]/25",
                    )}
                  >
                    <CalendarX2 size={12} aria-hidden className="shrink-0" />
                    {cutOffDue
                      ? `Cut off due · ${formatDate(source.date_cut_off)}`
                      : cutOffToday
                        ? `Due today · ${formatDate(source.date_cut_off)}`
                        : `Cut off · ${formatDate(source.date_cut_off)}`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-medium text-[var(--ink-muted)] ring-1 ring-inset ring-[var(--border)]">
                    <CalendarOff size={12} aria-hidden className="shrink-0" />
                    No cut-off date
                  </span>
                )}
              </div>
            </div>

            {/* ── Dialog Body (Scrollable) ── */}
            <div className="source-preview-scroll scrollbar-slim min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              {/* Optional Notes */}
              {source.notes ? (
                <div className="source-preview-block rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/40 p-3.5 text-xs">
                  <p className="type-eyebrow mb-1 text-[var(--ink-muted)]">
                    Description & Notes
                  </p>
                  <p className="leading-relaxed text-[var(--ink)]">
                    {source.notes}
                  </p>
                </div>
              ) : null}

              {/* ── Headline Stat Cards ── */}
              <div className="source-preview-block">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                  <StatTile
                    label="Allocated Budget"
                    value={formatMoney(allocated)}
                    subtext={`${budgetsCount} top-up ${
                      budgetsCount === 1 ? "allocation" : "allocations"
                    }`}
                    Icon={TrendingUp}
                    accent
                  />
                  <StatTile
                    label={
                      isClosed ? "Balance Forwarded" : "Remaining Available"
                    }
                    value={formatMoney(remaining)}
                    subtext={
                      isOverdrawn
                        ? "Deficit / Overdrawn"
                        : `${remainingPct.toFixed(1)}% of pool unspent`
                    }
                    Icon={PhilippinePeso}
                    isDanger={isOverdrawn}
                  />
                  <StatTile
                    label="Issued to Staff"
                    value={formatMoney(issued)}
                    subtext={`${issuedPct.toFixed(1)}% disbursed`}
                    Icon={HandCoins}
                  />
                  <StatTile
                    label="Total Liquidated"
                    value={formatMoney(spentTotal)}
                    subtext="Direct + Field liquidations"
                    Icon={ReceiptText}
                  />
                  <StatTile
                    label="Transactions"
                    value={sortedRows.length}
                    subtext={`${involvedCount} connected ${
                      involvedCount === 1 ? "party" : "parties"
                    }`}
                    Icon={ClipboardList}
                    className="col-span-2 sm:col-span-1"
                  />
                </div>
              </div>

              {/* ── People Involved ── */}
              <section className="source-preview-block">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-[var(--ink-muted)]" />
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      People Involved
                    </p>
                  </div>
                  {involvedCount > 0 && (
                    <Badge tone="neutral" className="tabular-nums">
                      {involvedCount}
                    </Badge>
                  )}
                </div>

                <div className="mt-2.5">
                  {involved.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--ink-muted)]">
                      No one connected to this source yet.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {involved.map((p, idx) => (
                        <span
                          key={p.user_id || p.name || idx}
                          className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)]/60 py-1 pl-1 pr-3 shadow-xs transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--surface-2)]"
                        >
                          <EmployeeAvatar
                            name={p.name}
                            avatarUrl={p.avatar_url}
                            className="h-6 w-6 shrink-0 text-[10px]"
                          />
                          <span className="max-w-[12rem] truncate text-xs font-medium text-[var(--ink)]">
                            {p.name || "Unknown"}
                          </span>
                          {p.role ? (
                            <span className="text-[10px] font-medium capitalize text-[var(--ink-muted)]">
                              {p.role}
                            </span>
                          ) : null}
                        </span>
                      ))}
                      {involvedCount > involved.length && (
                        <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2.5 text-[11px] font-medium tabular-nums text-[var(--ink-muted)] ring-1 ring-inset ring-[var(--border)]">
                          +{involvedCount - involved.length} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Listed Transactions ── */}
              <section className="space-y-3">
                <div className="source-preview-list-head flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardList
                      size={14}
                      className="text-[var(--ink-muted)]"
                    />
                    <p className="type-eyebrow text-[var(--ink-muted)]">
                      Listed Transactions
                    </p>

                    {/* Which type the list is narrowed to — stays visible in
                        the printed report so the paper shows the same type. */}
                    {activeType ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                          KIND_PILL_TONES[activeType.tone] ??
                            KIND_PILL_TONES.neutral,
                        )}
                      >
                        <ActiveTypeIcon size={10} aria-hidden />
                        {activeType.label}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {sortedRows.length > 0 && (
                      <div className="source-preview-no-print w-44 sm:w-48">
                        <Listbox
                          portal
                          options={typeOptions}
                          value={typeFilter}
                          onChange={setTypeFilter}
                          placeholder="All types"
                          buttonClassName="h-8 px-3"
                        />
                      </div>
                    )}

                    <Badge tone="neutral" className="tabular-nums">
                      {filteredRows.length}{" "}
                      {filteredRows.length === 1 ? "record" : "records"}
                    </Badge>
                  </div>
                </div>

                {/* List Container */}
                {sortedRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-xs text-[var(--ink-muted)]">
                    No transactions recorded for this source yet.
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-xs text-[var(--ink-muted)]">
                    <p>No transactions match the current filter.</p>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className="source-preview-no-print mt-2 font-medium text-[var(--accent-strong)] hover:underline"
                    >
                      Show all records
                    </button>
                  </div>
                ) : (
                  <div className="source-preview-list overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/30 divide-y divide-[var(--border)]">
                    {filteredRows.map((row, index) => {
                      const meta = TRANSACTION_KIND_META[row.kind] ?? null;
                      const Icon = meta?.Icon ?? ReceiptText;
                      const kindLabel = meta?.label ?? "Record";
                      const signed =
                        row.direction === "in"
                          ? "+"
                          : row.direction === "out"
                            ? "−"
                            : "";

                      // Attribution person or transfer pairing
                      const attribution = row.counterpartyName
                        ? `${row.employeeName || "Boss"} → ${row.counterpartyName}`
                        : row.employeeName || "Boss";

                      return (
                        <div
                          key={row.key ?? row.id ?? index}
                          className="source-preview-record flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-[var(--surface-2)]/70"
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                              KIND_TILE_TONES[meta?.tone] ??
                                KIND_TILE_TONES.neutral,
                            )}
                          >
                            <Icon size={14} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-[var(--ink)]">
                              {row.description || kindLabel}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] tabular-nums text-[var(--ink-muted)]">
                              {formatDate(row.date)} ·{" "}
                              <span className="font-medium text-[var(--ink)]/80">
                                {kindLabel}
                              </span>{" "}
                              · {attribution}
                              {row.categoryName ? ` · ${row.categoryName}` : ""}
                            </p>
                          </div>

                          <p
                            className={cn(
                              "shrink-0 font-display text-xs font-semibold tabular-nums",
                              row.direction === "in"
                                ? "text-[var(--success)]"
                                : row.direction === "out"
                                  ? "text-[var(--danger)]"
                                  : "text-[var(--ink)]",
                            )}
                          >
                            {signed} {formatMoney(row.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* ── Dialog Footer (Pinned) ── */}
            <div className="source-preview-footer flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)]/90 px-5 py-3.5 backdrop-blur-xs sm:px-6">
              <div className="min-w-0 truncate text-xs text-[var(--ink-muted)]">
                {filteredRows.length !== sortedRows.length ? (
                  <span>
                    Showing {filteredRows.length} of {sortedRows.length}{" "}
                    transactions
                  </span>
                ) : (
                  <span>
                    {sortedRows.length} total record
                    {sortedRows.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="shrink-0 rounded-full px-5 text-xs font-medium"
              >
                Close
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
