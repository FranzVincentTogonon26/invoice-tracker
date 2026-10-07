import { useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, HandCoins, Inbox, TrendingUp, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "../../../ui/PageHeader";
import { Button } from "../../../ui/Button";
import { StatCard } from "../../../ui/StatCard";
import { Badge } from "../../../ui/Badge";
import { Card, CardDescription, CardTitle } from "../../../ui/Card";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { useSourceFunds } from "../../../../hooks/useSourceFunds";
import { formatDate, formatMoney, formatTime, toMoney } from "@/lib/utils";
import { StatusBadge } from "./SourceBadges";

export function AdminSourceFundsOverview() {
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const referenceId =
    location.state?.referenceId ?? searchParams.get("ref") ?? null;

  const { sources, isLoading } = useSourceFunds();
  const source = useMemo(
    () => (sources ?? []).find((s) => s.reference_id === referenceId) ?? null,
    [sources, referenceId],
  );

  const backToList = () => nav("/admin/source-funds");

  if (!referenceId) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        <EmptyState
          icon={Inbox}
          title="No source selected"
          message="Open a source from the Source of Funds list to see its overview."
          onClear={backToList}
          clearLabel="Back to sources"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        <Card padding="lg">
          <LoadingSkeleton rows={4} />
        </Card>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        <EmptyState
          icon={Inbox}
          title="Source not found"
          message="It may have been deleted, or the link is out of date."
          onClear={backToList}
          clearLabel="Back to sources"
        />
      </div>
    );
  }

  const remaining = toMoney(source.remaining ?? 0);
  const used = toMoney(source.issued + source.expenses);
  const usedPct =
    source.allocated > 0
      ? Math.min(100, Math.max(0, (used / source.allocated) * 100))
      : 0;
  const involved = Array.isArray(source.involved) ? source.involved : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title={source.label || "Untitled source"}
        description={`Created ${formatDate(source.created_at)}${
          source.date_cut_off
            ? ` · cut off ${formatDate(source.date_cut_off)}`
            : ""
        }`}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <StatusBadge status={source.status} />
            <Button variant="outline" onClick={backToList}>
              <ArrowLeft size={15} /> All sources
            </Button>
          </div>
        }
      />

      {source.notes && (
        <p className="break-words rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed text-[var(--ink)] shadow-card">
          {source.notes}
        </p>
      )}

      <motion.div
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: 0.08, delayChildren: 0.02 },
          },
        }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4"
      >
        {[
          {
            label: "Allocated",
            value: formatMoney(source.allocated),
            icon: TrendingUp,
            accent: true,
          },
          {
            label: "Remaining",
            value: formatMoney(remaining),
            icon: Wallet,
          },
          {
            label: "Issued + Spent",
            value: formatMoney(used),
            icon: HandCoins,
          },
          {
            label: "Transactions",
            value: Number(source.transactions) || 0,
            icon: Inbox,
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
              },
            }}
            className="h-full [&>div]:h-full"
          >
            <StatCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              accent={card.accent}
            />
          </motion.div>
        ))}
      </motion.div>

      <Card padding="lg" className="relative overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Utilization</CardTitle>
          <span className="text-sm tabular-nums text-[var(--ink-muted)]">
            {usedPct.toFixed(1)}% used
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedPct)}
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usedPct}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="h-full rounded-full bg-[var(--accent)]"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Issued", value: formatMoney(source.issued) },
            { label: "Expenses", value: formatMoney(source.expenses) },
            { label: "Top-ups", value: Number(source.budgets) || 0 },
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
      </Card>

      <Card padding="lg" className="relative overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Account / Person</CardTitle>
          <Badge tone="neutral" className="shrink-0 tabular-nums">
            {Number(source.involved_count) || 0}
          </Badge>
        </div>
        <CardDescription className="mt-1 text-sm">
          Everyone connected to this source — issuance receivers, authors and
          transfer parties.
        </CardDescription>
        {involved.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-muted)]">
            Nobody connected to this source yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
            {involved.map((p) => (
              <li key={p.user_id || p.name} className="flex items-center gap-3 px-4 py-2.5">
                <EmployeeAvatar
                  name={p.name}
                  avatarUrl={p.avatar_url}
                  className="h-9 w-9 text-sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ink)]">
                  {p.name || "Unknown"}
                </span>
                <span className="shrink-0 text-xs capitalize text-[var(--ink-muted)]">
                  {p.role || ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(Number(source.involved_count) || 0) > involved.length && (
          <p className="mt-2 text-xs tabular-nums text-[var(--ink-muted)]">
            +{(Number(source.involved_count) || 0) - involved.length} more
          </p>
        )}
      </Card>

      <p className="text-xs text-[var(--ink-muted)]">
        Tip: copy this page's URL — it carries{" "}
        <span className="font-mono">?ref={source.reference_id}</span> so the
        same overview opens directly. You can also{" "}
        <Link
          to="/admin/source-funds"
          className="font-medium text-[var(--accent-strong)] hover:underline"
        >
          browse all sources
        </Link>
        .
      </p>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to sources"
      title="Back to sources"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
    >
      <ArrowLeft size={16} aria-hidden />
    </button>
  );
}

export default AdminSourceFundsOverview;
