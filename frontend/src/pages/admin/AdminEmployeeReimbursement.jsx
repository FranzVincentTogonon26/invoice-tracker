import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  HandCoins,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { SearchInput } from "../../components/ui/Input";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/DataState";
import { SelectEmployee } from "../../components/ui/SelectEmployee";
import ConfirmActionDialog from "../../components/layout/admin/expenses/ConfirmActionDialog";
import { useAbonoList, useAbonoMutations } from "../../hooks/useAbono";
import { cn, formatDate, formatMoney, formatTime } from "../../lib/utils";

// Money rule shared with the server (`Abono.settleOpen`): repaying takes
// OPEN abono out of the employee's spendable pool, so the checked total must
// fit their remaining balance — the server re-checks and refuses the rest.
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

function OpenRowCheck({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        checked
          ? "border-transparent bg-[var(--accent-strong)] text-white"
          : "border-[var(--border)] bg-[var(--surface)] text-transparent hover:border-[var(--accent)]/50",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <BadgeCheck size={13} aria-hidden />
    </button>
  );
}

export default function AdminEmployeeReimbursement() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [checked, setChecked] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Nests under ["abono", …] — the realtime bridge invalidates that root on
  // every money event, so repayments stream in with no manual refresh.
  const {
    data: rows,
    isLoading,
    error,
    refetch,
  } = useAbonoList({
    search: debouncedSearch.trim() || undefined,
  });
  const { reimburse } = useAbonoMutations();
  const repaying = reimburse.isPending;

  const openRows = useMemo(
    () => (rows ?? []).filter((r) => r.status === "open"),
    [rows],
  );
  const settledRows = useMemo(
    () => (rows ?? []).filter((r) => r.status !== "open"),
    [rows],
  );

  // Employees still holding out-of-pocket money, derived from their OPEN
  // rows — newest activity first, richest awaiting first.
  const awaiting = useMemo(() => {
    const map = new Map();
    for (const r of openRows) {
      const key = r.user_id;
      if (!key) continue;
      const entry = map.get(key) ?? {
        user_id: key,
        name: r.employee_name || "Unnamed employee",
        email: r.employee_email || "",
        avatar_url: r.employee_avatar || "",
        openTotal: 0,
        openCount: 0,
      };
      entry.openTotal = toMoney(entry.openTotal + Number(r.amount || 0));
      entry.openCount += 1;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.openTotal - a.openTotal);
  }, [openRows]);

  const awaitingTotal = useMemo(
    () => toMoney(awaiting.reduce((s, e) => s + e.openTotal, 0)),
    [awaiting],
  );

  // A selected employee who was fully repaid disappears from `awaiting` on
  // refetch — fall back to the settled rows so the history still names them.
  const selected = useMemo(() => {
    if (!employeeId) return null;
    return (
      awaiting.find((e) => e.user_id === employeeId) ?? {
        user_id: employeeId,
        name:
          settledRows.find((r) => r.user_id === employeeId)?.employee_name ||
          "Employee",
        email: "",
        avatar_url:
          settledRows.find((r) => r.user_id === employeeId)?.employee_avatar ||
          "",
        openTotal: 0,
        openCount: 0,
      }
    );
  }, [awaiting, settledRows, employeeId]);

  const employeeOpenRows = useMemo(
    () => openRows.filter((r) => r.user_id === employeeId),
    [openRows, employeeId],
  );
  const employeeSettledRows = useMemo(
    () =>
      settledRows
        .filter((r) => (employeeId ? r.user_id === employeeId : true))
        .slice(0, 50),
    [settledRows, employeeId],
  );

  const checkedRows = useMemo(
    () => employeeOpenRows.filter((r) => checked.has(r.id)),
    [employeeOpenRows, checked],
  );
  const checkedTotal = useMemo(
    () => toMoney(checkedRows.reduce((s, r) => s + Number(r.amount || 0), 0)),
    [checkedRows],
  );
  const allChecked =
    employeeOpenRows.length > 0 &&
    employeeOpenRows.every((r) => checked.has(r.id));

  const toggleRow = (id) => {
    if (repaying) return;
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (repaying || employeeOpenRows.length === 0) return;
    setChecked((prev) => {
      const every = employeeOpenRows.every((r) => prev.has(r.id));
      return every ? new Set() : new Set(employeeOpenRows.map((r) => r.id));
    });
  };

  const pickEmployee = (value) => {
    setEmployeeId(value ?? "");
    setChecked(new Set());
    setConfirmOpen(false);
  };

  const requestRepay = () => {
    if (repaying || checkedRows.length === 0) return;
    setConfirmOpen(true);
  };

  const runRepay = async () => {
    if (!employeeId || checkedRows.length === 0) return;
    try {
      const ids = checkedRows.map((r) => r.id);
      const res = await reimburse.mutateAsync({ userId: employeeId, ids });
      setChecked(new Set());
      setConfirmOpen(false);
      // Actor-only toast: the admin's device confirms; the employee's ledger
      // drops the rows silently over the socket.
      toast.success(res?.message || "Employee reimbursed.");
    } catch (err) {
      toast.error(err?.message || "Couldn't complete the reimbursement.");
    }
  };

  const confirmSummary =
    selected && checkedRows.length > 0 ? (
      <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm text-[var(--ink-muted)]">To</p>
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {selected.name}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-muted)]">Abono repaid</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">
            {checkedRows.length} record{checkedRows.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
          <p className="text-sm text-[var(--ink-muted)]">Repayment total</p>
          <p className="font-display text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatMoney(checkedTotal)}
          </p>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reimbursement"
        description="Repay employees who spent their own money — settle their open abono with cash back."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <Badge tone="accent" className="tabular-nums">
              {formatMoney(awaitingTotal)} awaiting
            </Badge>
          </div>
        }
      />

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
            label: "Awaiting Repayment",
            value: formatMoney(awaitingTotal),
            icon: Wallet,
            accent: true,
          },
          {
            label: "Employees Awaiting",
            value: awaiting.length,
            icon: Users,
          },
          {
            label: "Open Abono Records",
            value: openRows.length,
            icon: HandCoins,
            tone: "warning",
          },
          {
            label: "Settled Records",
            value: settledRows.length,
            icon: BadgeCheck,
            tone: "success",
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
              tone={card.tone}
              loading={isLoading}
            />
          </motion.div>
        ))}
      </motion.div>

      <Card
        padding="lg"
        className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
      >
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Repay an employee</CardTitle>
            <CardDescription className="text-sm">
              Pick an employee holding out-of-pocket abono, check the records
              being repaid, then confirm — settled rows leave their spendable
              balance immediately.
            </CardDescription>
          </div>
        </CardHeader>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="w-full lg:max-w-[360px]">
            <SelectEmployee
              employees={awaiting}
              value={employeeId}
              onChange={pickEmployee}
              placeholder={
                isLoading
                  ? "Loading employees…"
                  : awaiting.length === 0
                    ? "Nobody awaiting repayment"
                    : "Select employee to repay"
              }
              disabled={isLoading || repaying || awaiting.length === 0}
            />
          </div>
          <div className="min-w-0 flex-1 lg:max-w-[320px] lg:ml-auto">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search abono, employee, fund…"
              aria-label="Search abono records"
              leftIcon={<Search size={16} />}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={5} showAvatar />
        ) : error ? (
          <ErrorState
            title="Couldn't load abono records"
            message="Something went wrong while fetching out-of-pocket spending."
            onRetry={refetch}
          />
        ) : !employeeId ? (
          <EmptyState
            icon={HandCoins}
            title={
              awaiting.length === 0
                ? "Nobody awaiting repayment"
                : "Select an employee to repay"
            }
            message={
              awaiting.length === 0
                ? "Every out-of-pocket abono has been reimbursed."
                : "Choose an employee above to review their open abono."
            }
          />
        ) : employeeOpenRows.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title={`${selected?.name ?? "Employee"} is fully reimbursed`}
            message="No open abono remains — their history is listed below."
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/70 px-4 py-2.5">
                <OpenRowCheck
                  checked={allChecked}
                  onChange={toggleAll}
                  disabled={repaying}
                />
                <p className="text-xs font-semibold text-[var(--ink-muted)]">
                  {checked.size === 0
                    ? `Select records to repay · ${formatMoney(
                        employeeOpenRows.reduce(
                          (s, r) => s + Number(r.amount || 0),
                          0,
                        ),
                      )} open`
                    : `${checked.size} selected · ${formatMoney(checkedTotal)}`}
                </p>
                {selected && (
                  <p className="ml-auto truncate text-xs text-[var(--ink-muted)]">
                    {selected.name}
                  </p>
                )}
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {employeeOpenRows.map((r) => {
                  const isChecked = checked.has(r.id);
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isChecked}
                        disabled={repaying}
                        onClick={() => toggleRow(r.id)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          isChecked
                            ? "bg-[var(--accent-soft)]/40"
                            : "hover:bg-[var(--surface-2)]/60",
                          repaying && "pointer-events-none opacity-60",
                        )}
                      >
                        <OpenRowCheck
                          checked={isChecked}
                          onChange={() => toggleRow(r.id)}
                          disabled={repaying}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                            {r.description || "Abono"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--ink-muted)]">
                            {[r.reference_label, formatDate(r.created_at)]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink)]">
                          {formatMoney(r.amount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-2)]/40 px-4 py-3 sm:flex-row sm:items-center">
                <p className="text-sm tabular-nums text-[var(--ink-muted)]">
                  Repayment total{" "}
                  <span className="font-semibold text-[var(--ink)]">
                    {formatMoney(checkedTotal)}
                  </span>
                </p>
                <Button
                  type="button"
                  variant="accent"
                  onClick={requestRepay}
                  disabled={repaying || checkedRows.length === 0}
                  className="sm:ml-auto"
                >
                  {repaying && (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  )}
                  {repaying
                    ? "Repaying…"
                    : `Repay ${checkedRows.length === 0 ? "" : `${checkedRows.length} record${checkedRows.length === 1 ? "" : "s"}`}`}
                </Button>
              </div>
            </div>
          </>
        )}

        {!isLoading && !error && employeeSettledRows.length > 0 && (
          <div className="mt-6">
            <p className="type-eyebrow mb-2 text-[var(--ink-muted)]">
              Repayment history
              {selected ? ` — ${selected.name}` : ""}
            </p>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <ul className="divide-y divide-[var(--border)]">
                {employeeSettledRows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--success)]/12 text-[var(--success)]">
                      <BadgeCheck size={14} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--ink)]">
                        {r.description || "Abono"}
                      </span>
                      <span className="mt-0.5 block truncate text-xs tabular-nums text-[var(--ink-muted)]">
                        Settled{" "}
                        {r.date_settled
                          ? `${formatDate(r.date_settled)} · ${formatTime(r.date_settled)}`
                          : formatDate(r.created_at)}
                        {!employeeId &&
                          ` · ${r.employee_name || "Employee"}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--ink-muted)]">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      <ConfirmActionDialog
        open={confirmOpen}
        icon={<HandCoins size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title={`Repay ${selected?.name ?? "employee"} ${formatMoney(checkedTotal)}?`}
        description="The checked abono leave the employee's spendable balance as settled — cash back in their pocket. This can't be undone."
        summary={confirmSummary}
        cancelLabel="Go back"
        confirmLabel="Yes, repay"
        confirmVariant="accent"
        pendingLabel="Repaying…"
        pending={repaying}
        onCancel={() => {
          if (!repaying) setConfirmOpen(false);
        }}
        onConfirm={runRepay}
      />
    </div>
  );
}
