import { useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import toast from "react-hot-toast";
import {
  CalendarDays,
  Eye,
  Files,
  Loader2,
  Lock,
  Pencil,
  StickyNote,
  UserX,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmployeeAvatar } from "@/components/ui/SelectEmployee";
import { EmptyState, ErrorState } from "@/components/ui/DataState";
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
import {
  useEmployeeDetailsOverview,
  useIssuanceHolder,
} from "@/hooks/useEmployeeDetails";
import { BackButton, DetailsHeader } from "./EmployeeDetailsHeader";
import { EmployeeFundsPanel } from "./EmployeeFundsPanel";
import { EmployeeDetailsTabs } from "./EmployeeDetailsTabs";
import { TAB_META } from "@/lib/employeeDetailsTabs";

export default function AdminEmployeesDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const pathSection = useMemo(() => {
    const clean = pathname.replace(/\/+$/, "");
    if (clean.endsWith("/reimbursement")) return "reimbursement";
    if (clean.endsWith("/overview")) return "overview";
    return null;
  }, [pathname]);

  // Deep-link support (`?tab=` wins when valid) — otherwise the page always
  // opens on the Overview tab (`employee_transaction`), whatever the entry
  // section. Unknown values fall back the same way EmployeeDetailsTabs does
  // for bad links.
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    TAB_META.some((t) => t.value === requestedTab)
      ? requestedTab
      : "employee_transaction",
  );
  const [direction, setDirection] = useState(1);

  const {
    data: employees,
    isLoading,
    error,
    refetch,
  } = useEmployees({ status: "all" });

  const { updateAvatar } = useEmployeesMutations();
  const uploadingAvatar = updateAvatar.isPending;
  const avatarFileRef = useRef(null);

  const rosterMatch = useMemo(
    () => employees.find((e) => String(e.user_id) === String(id)),
    [employees, id],
  );
  const {
    holder,
    isLoading: holderLoading,
    issuedRef: holderIssuedRef,
  } = useIssuanceHolder(!isLoading && !rosterMatch ? id : null);
  const isBirLink = !rosterMatch && Boolean(holder?.user_id);
  const userId = rosterMatch?.user_id ?? holder?.user_id ?? null;
  const detailsId = rosterMatch?.user_id ?? (isBirLink ? id : null);

  const employee = useMemo(
    () =>
      rosterMatch ??
      employees.find((e) => String(e.user_id) === String(userId ?? "")),
    [rosterMatch, employees, userId],
  );

  // Page-URL view driving server-side scoping (`?view=` on every detail
  // request): `reimbursement` keys everything on ONE
  // `budget_issued_reference.id`; `overview` (and plain links) keys on the
  // user's OPEN holdings only (`status = 'open'`).
  const view = pathSection === "reimbursement" ? "reimbursement" : "overview";

  const {
    data: detailOverview,
    isLoading: traceLoading,
    error: detailError,
    issuedRef: detailIssuedRef,
  } = useEmployeeDetailsOverview(detailsId, view);

  // First paint waits for the scoped payload: rendering roster aggregates
  // first and swapping to scoped figures when the detail query lands flickers
  // (e.g. spent reads 1000, then snaps to 0). So the skeleton stays up until
  // the scoped overview resolves (or errors — then the page falls back to
  // roster figures and the tabs surface their own errors).
  // `detailsId` is null while a bir-link holder is still resolving — that is
  // covered by `resolvingHolder`, so a failed lookup still reaches the
  // not-found state instead of hanging on the skeleton.
  const resolvingHolder = !isLoading && !rosterMatch && holderLoading;
  const scopedReady = Boolean(detailOverview) || Boolean(detailError);
  const pageLoading =
    isLoading || resolvingHolder || (detailsId ? !scopedReady : false);

  const fromReimbursement = pathSection === "reimbursement";
  // The issuance record behind a reimbursement view (status, source label,
  // dates) — drives the view-only banner below. The scoped overview payload
  // is authoritative; the holder lookup is the fallback while it resolves.
  const recordRef = fromReimbursement
    ? (detailIssuedRef ?? holderIssuedRef ?? null)
    : null;
  const recordClosed = recordRef?.status === "close";
  // The issuance note block displays only on a finalized (closed) record
  // opened from the reimbursement ledger AND only when the record actually
  // carries notes (`budget_issued_reference.notes`, stamped by the submit
  // dialog — older closed records have NULL there and correctly show no
  // note block).
  const showRecordNote =
    fromReimbursement && recordClosed && Boolean(recordRef?.notes?.trim());
  const backTarget = fromReimbursement
    ? "/admin/reimbursement"
    : "/admin/employees";
  const backLabel = fromReimbursement
    ? "Back to reimbursement"
    : "Back to employees";
  const backToList = () => nav(backTarget);

  const openAvatarPicker = () => {
    if (!uploadingAvatar) avatarFileRef.current?.click();
  };

  const onAvatarPick = async (event) => {
    const picked = event.target.files?.[0];
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

  const changeTab = (value) => {
    if (value === tab) return;
    const nextIndex = TAB_META.findIndex((t) => t.value === value);
    const currentIndex = TAB_META.findIndex((t) => t.value === tab);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setTab(value);
  };

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

  // NOTE: every hook must stay above the early returns below — a hook after
  // a conditional return changes the hook count between renders ("Rendered
  // more hooks than during the previous render").
  const fundsByIssuance = useMemo(() => {
    if (!isBirLink) return null;
    const feed = detailOverview?.transactions ?? [];
    const birId = String(id);
    const ofRecord = (t) => String(t?.issued_ref_id ?? "") === birId;
    const num = (v) => Number(v) || 0;
    const round = (n) => Math.round(n * 100) / 100;
    const sum = (pred) =>
      round(
        feed
          .filter(ofRecord)
          .filter(pred)
          .reduce((s, t) => s + num(t.amount), 0),
      );

    return {
      issued: sum((t) => t.kind === "issued" && t.status !== "cancel"),
      spent: sum((t) => t.kind === "expense" && t.status === "paid"),
      abono: sum((t) => t.kind === "abono" && t.status === "open"),
      sent: sum((t) => t.direction === "sent" && t.status === "success"),
      received: 0,
    };
  }, [isBirLink, detailOverview, id]);

  if (pageLoading) {
    return (
      <div
        className="space-y-4"
        role="status"
        aria-label="Loading employee details"
      >
        <DetailsHeader onBack={backToList} backLabel={backLabel} />
        {/* Profile card mirror — same frame and flex layout as the loaded
            card (avatar + identity left, Remaining block right) so nothing
            shifts when the real figures paint. */}
        <Card padding="lg" className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(ellipse_at_top_right,var(--accent-soft)_0%,transparent_70%)] opacity-70"
          />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-hidden
                className="h-13 w-13 shrink-0 animate-pulse rounded-2xl bg-[var(--border)]"
              />
              <div aria-hidden className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-4 w-56 max-w-full animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-44 max-w-full animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
            <div className="w-full lg:max-w-sm lg:shrink-0" aria-hidden>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-[var(--border)]" />
                    <div className="h-3 w-24 animate-pulse rounded bg-[var(--border)]" />
                  </div>
                  <div className="h-8 w-32 animate-pulse rounded bg-[var(--border)]" />
                </div>
                <div className="h-6 w-20 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
              </div>
              <div className="mt-2 h-1 animate-pulse overflow-hidden rounded-full bg-[var(--border)]" />
            </div>
          </div>
        </Card>
        {/* Funds panel mirror — metric tiles + strip + trace chart block. */}
        <Card padding="md" className="relative overflow-hidden">
          <div aria-hidden className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-2.5"
              >
                <div className="mx-auto h-3 w-20 animate-pulse rounded bg-[var(--border)]" />
                <div className="mx-auto mt-2 h-4 w-24 animate-pulse rounded bg-[var(--border)]" />
              </div>
            ))}
          </div>
          <div
            aria-hidden
            className="mt-2.5 h-9 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70"
          />
          <div
            aria-hidden
            className="mt-3 border-t border-[var(--border)] pt-3"
          >
            <div className="h-[150px] animate-pulse rounded-2xl bg-[var(--surface-2)]/60" />
          </div>
        </Card>
        {/* Tabs mirror — pill bar plus panel rows. */}
        <div className="space-y-3" aria-hidden>
          <div className="sticky top-0 z-10 bg-[var(--bg)]/90 py-2 backdrop-blur-sm md:-mx-1 md:px-1">
            <div className="inline-flex w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] p-1 sm:w-auto">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 flex-1 animate-pulse rounded-full bg-[var(--border)] sm:w-24 sm:flex-none"
                />
              ))}
            </div>
          </div>
          <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
            <div className="h-4 w-2/5 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-3/5 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-4">
        <BackButton onClick={backToList} label={backLabel} />
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

  // Every displayed money figure follows the view's reference:
  // - `reimbursement`: the ONE issuance record (`issued_ref_id` = route id).
  // - `overview`/plain: the user's OPEN holdings only — header, funds strip
  //   and tabs all read the strict scoped totals, never the whole-account
  //   roster aggregates (closed holdings stay out everywhere).
  // Falls back to the roster row while the scoped payload is still loading.
  const strictSource =
    view === "reimbursement"
      ? fundsByIssuance
      : detailOverview
        ? {
            issued: detailOverview.totalBudget,
            spent: detailOverview.totalExpenses,
            received: detailOverview.totalReceived,
            abono: detailOverview.totalAbono,
            sent: detailOverview.totalSent,
          }
        : null;
  const {
    issued,
    spent,
    remaining,
    received,
    abono,
    sent,
    funded,
    spentShare,
  } = budgetBreakdown(
    strictSource
      ? {
          issued_budget: strictSource.issued,
          total_spent: strictSource.spent,
          total_received: strictSource.received,
          total_abono: strictSource.abono,
          total_sent: strictSource.sent,
        }
      : employee,
  );
  const overSpent = remaining < 0;
  const references = Number(employee.issued_references) || 0;

  return (
    <div className="space-y-4">
      <DetailsHeader
        onBack={backToList}
        backLabel={backLabel}
        description={
          fromReimbursement
            ? "Single issuance record — read-only view of its done transactions."
            : "Budget, expenses and transaction records for this employee."
        }
        actions={
          <>
            <EmployeeStatusBadge status={employee.status} />
            <Badge tone="neutral" className="capitalize">
              {employee.role || "employee"}
            </Badge>
          </>
        }
      />

      {/* Reimbursement-only view-mode banner: this URL shows ONE finalized
          issuance record, never the whole account — figures and tabs below
          cover that record alone and nothing here can be edited. */}
      {/* Shown only for a finalized (closed) issuance record opened from
          the reimbursement ledger — open records stay banner-free. Note the
          status value is `close` (not `closed`) per the
          `budget_issued_reference` CHECK constraint. */}
      {fromReimbursement && recordClosed && (
        <section
          aria-label="Finalized issuance record"
          className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card"
        >
          <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3 sm:px-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--bg)]">
              <Lock size={17} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-display text-[15px] font-medium tracking-tight text-[var(--ink)]">
                Finalized issuance record
                {recordRef && (
                  <StatusBadge status={recordRef.status} dot={false} />
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                View-only
                {recordRef?.date_forwarded
                  ? ` · finalized ${formatDate(recordRef.date_forwarded)}`
                  : ""}
                {" · "}only done transactions below
              </p>
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)] ring-1 ring-inset ring-[var(--border)] sm:inline-flex">
              <Eye size={12} aria-hidden />
              View only
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-px bg-[var(--border)]/60 sm:grid-cols-3">
            <div className="min-w-0 bg-[var(--surface)] px-4 py-3 sm:px-5">
              <dt className="type-eyebrow text-[var(--ink-muted)]">
                Source of funds
              </dt>
              <dd className="mt-1 truncate text-sm font-medium text-[var(--ink)]">
                {recordRef?.reference_label || "—"}
              </dd>
            </div>
            <div className="min-w-0 bg-[var(--surface)] px-4 py-3 sm:px-5">
              <dt className="type-eyebrow text-[var(--ink-muted)]">
                Date finalized
              </dt>
              <dd className="mt-1 whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]">
                {recordRef?.date_forwarded
                  ? formatDate(recordRef.date_forwarded)
                  : "—"}
              </dd>
            </div>
            <div className="min-w-0 bg-[var(--surface)] px-4 py-3 sm:px-5">
              <dt className="type-eyebrow text-[var(--ink-muted)]">
                Balance forwarded
              </dt>
              <dd className="mt-1 whitespace-nowrap font-display text-[15px] font-medium tabular-nums text-[var(--accent-strong)]">
                {formatMoney(remaining)}
              </dd>
            </div>
          </dl>
          {showRecordNote ? (
            <div className="border-t border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)]/40 px-3.5 py-3">
                <StickyNote
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--accent-strong)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="type-eyebrow text-[var(--accent-strong)]">
                    Issuance note
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-[var(--ink)]">
                    {recordRef.notes.trim()}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

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
              {/* Hidden in the reimbursement view-only record — nothing
                  here may be edited. */}
              {!fromReimbursement && (
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
              )}
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
                  {fromReimbursement
                    ? "1 issuance record"
                    : `${references} ${references === 1 ? "issuance" : "issuances"}`}
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
        employeeId={detailsId ?? employee.user_id}
        view={view}
      />
    </div>
  );
}
