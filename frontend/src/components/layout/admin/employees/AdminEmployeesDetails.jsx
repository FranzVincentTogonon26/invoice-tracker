import { Children, Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Files,
  HandCoins,
  Receipt,
  UserX,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmployeeAvatar } from "@/components/ui/SelectEmployee";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "@/components/ui/DataState";
import {
  EmployeeStatusBadge,
  RemainingProgress,
  SharePill,
} from "./EmployeesTable";
import { budgetBreakdown } from "@/constants";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { useEmployees } from "@/hooks/useEmployees";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import EmployeeTransaction from "./EmployeeTransaction";
import EmployeeBudget from "./EmployeeBudget";
import EmployeeExpenses from "./EmployeeExpenses";
import EmployeeAbono from "./EmployeeAbono";

// Tab order drives the panel slide direction.
const TAB_META = [
  { value: "employee_transaction", label: "Overview" },
  { value: "employee_budget", label: "Budget" },
  { value: "employee_expenses", label: "Expenses" },
  { value: "employee_abono", label: "Abono" },
];

// The curve the rest of the app animates with (shells, tab panels, dialogs).
const PANEL_EASE = [0.16, 1, 0.3, 1];

// Compact centered budget tile — label over a single centered value row;
// optional breakdown figures ride in the same row, split by vertical rules.
function BudgetMetric({ icon: Icon, label, value, tone, children }) {
  // toArray drops the `false` from `{cond && <row />}` pairs, so the rule
  // only renders when at least one breakdown row actually exists.
  const breakdown = Children.toArray(children).filter(Boolean);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
      <div className="flex items-center justify-center gap-2">
        <Icon size={14} aria-hidden className="text-[var(--ink-muted)]" />
        <p className="type-eyebrow text-[var(--ink-muted)]">{label}</p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <p
          className={cn(
            "font-display text-[15px] font-semibold tabular-nums",
            tone === "danger"
              ? "text-[var(--danger)]"
              : tone === "accent"
                ? "text-[var(--accent-strong)]"
                : tone === "warning"
                  ? "text-[var(--warning)]"
                  : "text-[var(--ink)]",
          )}
        >
          {value}
        </p>
        {breakdown.map((row, i) => (
          <Fragment key={i}>
            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-[var(--border)]"
            />
            {row}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/**
 * Admin → Employees → profile detail (route `employees/:id`).
 * Read-only account + budget overview fed by the same roster endpoint the
 * table uses (`status: "all"` so pending/inactive accounts resolve too), with
 * every figure derived through the shared `budgetBreakdown` helper — the
 * detail page can never disagree with the table it came from.
 */
export default function AdminEmployeesDetails() {
  const { id } = useParams();
  const nav = useNavigate();

  const [tab, setTab] = useState("employee_transaction");
  // +1 slides the next panel in from the right, -1 from the left — the panel
  // transition follows the tab order.
  const [direction, setDirection] = useState(1);

  // `status: "all"` bypasses the endpoint's active-only default so an admin
  // can open any account regardless of its current status.
  const {
    data: employees,
    isLoading,
    error,
    refetch,
  } = useEmployees({ status: "all" });

  const employee = useMemo(
    () => employees.find((e) => String(e.user_id) === String(id)),
    [employees, id],
  );

  const backToList = () => nav("/admin/employees");

  // Direction-aware tab switch: the panel animation matches the tab order.
  const changeTab = (value) => {
    if (value === tab) return;
    const nextIndex = TAB_META.findIndex((t) => t.value === value);
    const currentIndex = TAB_META.findIndex((t) => t.value === tab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setTab(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DetailsHeader onBack={backToList} />
        <Card padding="lg">
          <LoadingSkeleton rows={3} showAvatar />
        </Card>
        <Card padding="lg">
          <LoadingSkeleton rows={3} />
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} />
        {error ? (
          <ErrorState
            title="Couldn't load this employee"
            message="Something went wrong while fetching the employee roster."
            onRetry={refetch}
            onClearFilters={backToList}
            clearLabel="Back to employees"
          />
        ) : (
          <EmptyState
            icon={UserX}
            title="Employee not found"
            message="This account may have been removed, or the link is out of date."
            onClear={backToList}
            clearLabel="Back to employees"
          />
        )}
      </div>
    );
  }

  const {
    issued,
    spent,
    remaining,
    received,
    abono,
    sent,
    funded,
    spentShare,
  } = budgetBreakdown(employee);
  const overSpent = remaining < 0;
  const references = Number(employee.issued_references) || 0;

  return (
    <div className="space-y-4">
      <DetailsHeader
        onBack={backToList}
        description="Budget, expenses and transaction records for this employee."
        actions={
          <>
            <EmployeeStatusBadge status={employee.status} />
            <Badge tone="neutral" className="capitalize">
              {employee.role || "employee"}
            </Badge>
          </>
        }
      />

      <Card padding="lg" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft)_0%,transparent_70%)] opacity-70"
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <EmployeeAvatar
              name={employee.name}
              avatarUrl={employee.avatar_url}
              className="h-12 w-12 shrink-0 rounded-2xl text-lg ring-1 ring-inset ring-[var(--accent)]/15"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
                {employee.name}
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--ink-muted)]">
                {employee.email}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={13} aria-hidden />
                  Joined{" "}
                  {employee.created_at ? formatDate(employee.created_at) : "—"}
                </span>
                <span aria-hidden className="opacity-40">
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Files size={13} aria-hidden />
                  {references} {references === 1 ? "issuance" : "issuances"}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full lg:max-w-sm lg:shrink-0">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="type-eyebrow text-[var(--ink-muted)]">
                    Remaining
                  </p>
                  <p className="truncate text-xs tabular-nums text-[var(--ink-muted)]">
                    of {formatMoney(funded)} funded
                  </p>
                </div>
                <p
                  className={cn(
                    "mt-1 font-display text-2xl font-semibold leading-none tracking-tight tabular-nums",
                    overSpent ? "text-[var(--danger)]" : "text-[var(--ink)]",
                  )}
                >
                  {formatMoney(remaining)}
                </p>
              </div>
              <SharePill
                remaining={remaining}
                funded={funded}
                spentShare={spentShare}
                overSpent={overSpent}
                className="shrink-0"
              />
            </div>
            <div className="mt-2">
              <RemainingProgress
                remaining={remaining}
                funded={funded}
                spentShare={spentShare}
                overSpent={overSpent}
                label={`Remaining balance for ${employee.name ?? "employee"}`}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BudgetMetric
            icon={Wallet}
            label="Issued Budget"
            value={formatMoney(issued)}
          >
            {received > 0 && (
              <p
                className="text-xs font-semibold tabular-nums text-[var(--accent-strong)]"
                title={`${formatMoney(received)} received from budget transfers`}
              >
                + {formatMoney(received)} received
              </p>
            )}
          </BudgetMetric>
          <BudgetMetric
            icon={Receipt}
            label="Total Spent"
            value={formatMoney(spent)}
          >
            {sent > 0 && (
              <p
                className="text-xs font-semibold tabular-nums text-[var(--danger)]"
                title={`${formatMoney(sent)} sent via budget transfers`}
              >
                - {formatMoney(sent)} sent
              </p>
            )}
          </BudgetMetric>
          <BudgetMetric
            icon={HandCoins}
            label="Abono Held"
            value={formatMoney(abono)}
            tone={abono > 0 ? "warning" : undefined}
          />
        </div>
      </Card>

      <Tabs value={tab} onValueChange={changeTab} className="space-y-3">
        <div className="sticky top-0 z-10 bg-[var(--bg)]/90 py-1 backdrop-blur-sm md:-mx-1 md:px-1">
          <TabsList className="w-full max-w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-auto sm:self-start">
            {TAB_META.map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="grow justify-center px-2.5 sm:grow-0 sm:px-4"
              >
                <span className="block w-full whitespace-nowrap text-center type-eyebrow">
                  {label}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Direct AnimatePresence control (not TabsContent) so the exit animation can play. */}
        <div className="relative">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={tab}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.28, ease: PANEL_EASE }}
            >
              {tab === "employee_transaction" && (
                <EmployeeTransaction userId={employee.user_id} />
              )}
              {tab === "employee_budget" && (
                <EmployeeBudget userId={employee.user_id} />
              )}
              {tab === "employee_expenses" && (
                <EmployeeExpenses userId={employee.user_id} />
              )}
              {tab === "employee_abono" && (
                <EmployeeAbono userId={employee.user_id} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}

// Compact breadcrumb header — back circle plus a small "Employees / Profile"
// trail with status badges pinned right. The employee's name already leads
// the hero card, so the header stays a quiet small label instead of a second
// large title.
function DetailsHeader({ onBack, actions, description }) {
  return (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} />
      <div className="min-w-0 flex-1">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-sm"
        >
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            Employees
          </button>
          <span
            aria-hidden
            className="shrink-0 text-[var(--ink-muted)] opacity-50"
          >
            /
          </span>
          <span className="truncate font-medium text-[var(--ink)]">
            Profile
          </span>
        </nav>
        {description && (
          <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

// Icon-only circular back button shared by every state — matches the
// BudgetTransfer / AddExpenses header pattern (border + surface + shadow),
// so it reads as a button instead of a text link.
function BackButton({ onClick, label = "Back to employees" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
    >
      <ArrowLeft size={16} aria-hidden />
    </button>
  );
}
