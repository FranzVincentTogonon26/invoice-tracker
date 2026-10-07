import { Pencil, X } from "lucide-react";
import { Button } from "../../../ui/Button";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { StatusBadge } from "./SourceBadges";

export function SourceViewModal({ source, onClose, onEdit }) {
  if (!source) return null;
  const spent = toMoney(source.issued + source.expenses);
  const usedPct =
    source.allocated > 0
      ? Math.min(100, Math.max(0, (spent / source.allocated) * 100))
      : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Source ${source.label}`}
        className="relative w-full max-w-[480px] rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-hover sm:p-7"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-medium tracking-tight">
              {source.label || "Untitled source"}
            </h3>
            <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
              {formatDate(source.created_at)}
              {source.created_at ? ` · ${formatTime(source.created_at)}` : ""}
              {source.date_cut_off
                ? ` · cut off ${formatDate(source.date_cut_off)}${source.date_cut_off ? ` ${formatTime(source.date_cut_off)}` : ""}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={source.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {source.notes && (
          <p className="mt-3 break-words rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3 text-sm leading-relaxed text-[var(--ink)]">
            {source.notes}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
          <p className="type-eyebrow text-[var(--ink-muted)]">Total Spent</p>
          <p className="text-sm font-medium tabular-nums text-[var(--ink)]">
            {formatMoney(source.expenses)}
          </p>
        </div>

        <div className="mt-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/40 px-4 py-4 text-center">
          <p className="type-eyebrow text-[var(--accent-strong)]">Remaining</p>
          <p className="mt-1 font-display text-3xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
            {formatMoney(source.remaining)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-[var(--ink-muted)]">
            {formatMoney(source.allocated)} allocated · {usedPct.toFixed(1)}%
            used
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Allocated", value: formatMoney(source.allocated) },
            { label: "Issued", value: formatMoney(source.issued) },
            { label: "Expenses", value: formatMoney(source.expenses) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-[var(--border)] px-2 py-3"
            >
              <p className="type-eyebrow text-[var(--ink-muted)]">
                {stat.label}
              </p>
              <p className="mt-1 truncate text-sm font-medium tabular-nums text-[var(--ink)]">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
          <span className="text-[var(--ink-muted)]">Transactions</span>
          <span className="font-medium tabular-nums text-[var(--ink)]">
            {Number(source.transactions) || 0}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
          <span className="text-[var(--ink-muted)]">Budget top-ups</span>
          <span className="font-medium tabular-nums text-[var(--ink)]">
            {Number(source.budgets) || 0}
          </span>
        </div>
        <div className="mt-2 rounded-2xl border border-[var(--border)] px-4 py-3">
          <p className="type-eyebrow mb-2 text-[var(--ink-muted)]">
            Account / Person · {Number(source.involved_count) || 0}
          </p>
          {(source.involved ?? []).length === 0 ? (
            <p className="text-xs text-[var(--ink-muted)]">
              Nobody connected to this source yet.
            </p>
          ) : (
            <ul className="max-h-36 space-y-1.5 overflow-y-auto">
              {(source.involved ?? []).map((p) => (
                <li
                  key={p.user_id || p.name}
                  className="flex items-center gap-2.5"
                >
                  <EmployeeAvatar
                    name={p.name}
                    avatarUrl={p.avatar_url}
                    className="h-7 w-7 text-[11px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                    {p.name || "Unknown"}
                  </span>
                  <span className="shrink-0 text-xs capitalize text-[var(--ink-muted)]">
                    {p.role || ""}
                  </span>
                </li>
              ))}
              {(Number(source.involved_count) || 0) >
                (source.involved ?? []).length && (
                <li className="text-xs tabular-nums text-[var(--ink-muted)]">
                  +
                  {(Number(source.involved_count) || 0) -
                    (source.involved ?? []).length}{" "}
                  more
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="accent" onClick={() => onEdit(source)}>
            <Pencil size={14} /> Edit source
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SourceViewModal;
