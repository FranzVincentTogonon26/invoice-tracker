import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarDays, Files, Loader2, Pencil, UserX } from "lucide-react";
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
import { AVATAR_ACCEPT, AVATAR_EXTENSIONS, budgetBreakdown } from "@/constants";
import {
  cn,
  fileExtension,
  formatDate,
  formatMoney,
  formatTime,
} from "@/lib/utils";
import { useEmployees, useEmployeesMutations } from "@/hooks/useEmployees";
import { useEmployeeDetailsOverview } from "@/hooks/useEmployeeDetails";
import { BackButton, DetailsHeader } from "./EmployeeDetailsHeader";
import { EmployeeFundsPanel } from "./EmployeeFundsPanel";
import { EmployeeDetailsTabs } from "./EmployeeDetailsTabs";
import { TAB_META } from "@/lib/employeeDetailsTabs";

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

  const { updateAvatar } = useEmployeesMutations();
  const uploadingAvatar = updateAvatar.isPending;
  const avatarFileRef = useRef(null);

  // Trace feed for the chart below — every transaction on this account.
  // Loaded alongside the roster (not gated on `employee`) so hooks stay
  // unconditional; the query is id-scoped server-side.
  const { data: detailOverview, isLoading: traceLoading } =
    useEmployeeDetailsOverview(id);

  const employee = useMemo(
    () => employees.find((e) => String(e.user_id) === String(id)),
    [employees, id],
  );

  const backToList = () => nav("/admin/employees");

  const openAvatarPicker = () => {
    if (!uploadingAvatar) avatarFileRef.current?.click();
  };

  // Pencil-button photo change: pick → validate → auto-save. Same photo
  // rules as the employee's own Account tab (extensions only, no size cap).
  const onAvatarPick = async (event) => {
    const picked = event.target.files?.[0];
    // Reset the input so re-picking the SAME file still fires onChange.
    event.target.value = "";
    if (!picked || !employee) return;

    if (!AVATAR_EXTENSIONS.includes(fileExtension(picked.name))) {
      toast.error("Photos only — PNG, JPG, JPEG, WEBP, HEIC or HEIF.");
      return;
    }

    try {
      await updateAvatar.mutateAsync({ id: employee.user_id, file: picked });
      toast.success(`Updated photo for ${employee.name}.`);
    } catch (err) {
      toast.error(
        err?.message || "Couldn't update the photo. Please try again.",
      );
    }
  };

  // Direction-aware tab switch: the panel animation matches the tab order.
  const changeTab = (value) => {
    if (value === tab) return;
    const nextIndex = TAB_META.findIndex((t) => t.value === value);
    const currentIndex = TAB_META.findIndex((t) => t.value === tab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setTab(value);
  };

  // Trace feed — three independent running lines (cumulative issued,
  // cumulative spent, cumulative abono), oldest first. Each line only ever
  // climbs when its own kind lands; hovering any point compares that date's
  // record against all three running totals. Written without reassignment
  // (prefix sums over the head slice) so no render-phase mutation lint fires.
  // NOTE: must stay above the early returns below — hooks can't move
  // between renders, and these returns skip the rest of the component.
  const traceData = useMemo(() => {
    const feed = detailOverview?.transactions ?? [];
    const short = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
    };
    const full = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return `${formatDate(iso)} · ${formatTime(iso)}`;
    };
    const round = (n) => Math.round(n * 100) / 100;
    const amountOf = (t) => Number(t.amount) || 0;
    const isIssued = (t) => t.kind === "issued" || t.direction === "received";
    const isAbono = (t) => !isIssued(t) && t.kind === "abono";
    const sorted = [...feed].sort(
      (a, b) => new Date(a.date ?? 0) - new Date(b.date ?? 0),
    );
    const cumSum = (head, pred) =>
      round(head.filter(pred).reduce((s, t) => s + amountOf(t), 0));
    return sorted.map((t, i) => {
      const head = sorted.slice(0, i + 1);
      const amount = amountOf(t);
      const base = {
        label: short(t.date),
        fullDate: full(t.date),
        title: t.description || "",
        status: t.status || "",
        amount,
        signed: "",
        cumIssued: cumSum(head, isIssued),
        cumSpent: cumSum(head, (x) => !isIssued(x) && !isAbono(x)),
        cumAbono: cumSum(head, isAbono),
        kindLabel: t.kind || "record",
        dot: "bg-[var(--ink-muted)]",
      };
      if (isIssued(t))
        return {
          ...base,
          signed: "+",
          kindLabel:
            t.kind === "issued" ? "Budget issued" : "Transfer received",
          dot: "bg-[var(--accent)]",
        };
      if (isAbono(t))
        return {
          ...base,
          signed: "+",
          kindLabel: "Abono",
          dot: "bg-[var(--warning)]",
        };
      return {
        ...base,
        signed: "−",
        kindLabel:
          t.kind === "expense"
            ? "Expense"
            : t.direction === "sent"
              ? "Transfer sent"
              : (t.kind ?? "record"),
        dot: "bg-[var(--danger)]",
      };
    });
  }, [detailOverview]);

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
            <div className="relative shrink-0">
              <EmployeeAvatar
                key={employee.avatar_url ?? "none"}
                name={employee.name}
                avatarUrl={employee.avatar_url}
                className="h-13 w-13 shrink-0 rounded-2xl text-lg ring-1 ring-inset ring-[var(--accent)]/15"
              />
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploadingAvatar}
                aria-label={`Change photo for ${employee.name}`}
                title="Change photo"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] shadow-card transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:pointer-events-none disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <Loader2 size={13} aria-hidden className="animate-spin" />
                ) : (
                  <Pencil size={13} aria-hidden />
                )}
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept={AVATAR_ACCEPT}
                onChange={onAvatarPick}
                className="hidden"
                aria-hidden
                tabIndex={-1}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-medium tracking-tight text-[var(--ink)]">
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
                    "mt-1 font-display text-2xl font-medium leading-none tracking-tight tabular-nums",
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

      <EmployeeFundsPanel
        issued={issued}
        received={received}
        spent={spent}
        sent={sent}
        abono={abono}
        traceData={traceData}
        traceLoading={traceLoading}
      />

      <EmployeeDetailsTabs
        tab={tab}
        onTabChange={changeTab}
        direction={direction}
        employeeId={employee.user_id}
      />
    </div>
  );
}
