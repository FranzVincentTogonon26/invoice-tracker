import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  HandCoins,
  Inbox,
  Lock,
  PhilippinePesoIcon,
  ReceiptText,
  StickyNote,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../../ui/PageHeader";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { Card } from "../../../ui/Card";
import { EmptyState } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { BackButton } from "../employees/EmployeeDetailsHeader";
import { SettleAbonoModal } from "./SettleAbonoModal";
import { BalanceStat } from "./BalanceStat";
import { ReviewSection, ReviewSectionSkeleton } from "./ReviewSection";
import { formatDate, formatMoney } from "@/lib/utils";
import { useReimbursementOverview } from "../../../../hooks/useEmployeeReimbursement";
import {
  useEmployeeDetailsOverview,
  useIssuanceHolder,
} from "../../../../hooks/useEmployeeDetails";

// Admin → Reimbursement → personnel row → per-RECORD detail (route
// `reimbursement/:id`, where `:id` is the `budget_issued_reference` row id
// the personnel table navigates with). Reads the same fund-pool overview as
// the list and expands the matching issuance record: identity, per-record
// balance hero stats and its source/status context. Records missing from the
// overview lists (finalized with no live children left, or under a cut-off
// source) resolve their `budget_issued_reference` row directly by id, so the
// entries shown are always that exact record's. Legacy per-user URLs (and
// backends predating `records`) fall back to the per-user personnel ledger
// row, so old links keep working. Someone with no open issuance resolves to
// an empty state instead of a broken page.
//
// The review checklist below follows the same scope as the hero: the record's
// own expenses via `recordId` (`expenses.issued_ref_id`) in record mode, the
// employee's whole ledger in legacy per-user mode. Ticks and settle actions
// stay row-level (server ownership-checked), so they keep receiving the
// employee's user id plus account-level lock context.
//
// Heavy pieces live in siblings: BalanceStat (stat tile), ReviewSection
// (checklist + summary + dialogs) and SettleAbonoModal. Pure review rules
// live in @/lib/reimbursement.
export function AdminEmployeeReimbursementDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useReimbursementOverview();

  const personnel = data?.personnel ?? [];
  const records = data?.records ?? [];
  // Record-first resolution: a personnel-table row carries its issuance
  // record id. A URL holding a user id instead (legacy links) matches no
  // record and flows into the per-user fallback below.
  const recordMatch = records.find((r) => String(r.id) === String(id)) ?? null;
  const personnelRow =
    personnel.find(
      (r) => String(r.userId) === String(recordMatch?.userId ?? id),
    ) ?? null;
  // Direct resolution: the overview lists only records holding live money
  // under open sources, so a finalized record with fully-cancelled children
  // (or under a cut-off source) matches nothing above. Resolve its
  // `budget_issued_reference` row directly by id instead of showing the
  // wrong scope (per-user aggregates) or a broken page.
  const directId = !isLoading && !recordMatch && !personnelRow ? id : null;
  const { holder: directHolder, isLoading: directHolderLoading } =
    useIssuanceHolder(directId);
  const {
    data: directOverview,
    error: directOverviewError,
    issuedRef: directIssuedRef,
  } = useEmployeeDetailsOverview(directHolder ? id : null, "reimbursement");
  const directPending =
    Boolean(directId) &&
    (directHolderLoading ||
      Boolean(directHolder && !directOverview && !directOverviewError));
  // Same per-record shape as the overview `records` rows, keyed on this ONE
  // `budget_issued_reference.id` via the record-scoped overview (legs use
  // `issued_ref_id`, matching the checklist scope). `birStatuses` carries
  // just this record's status so the review lock follows the record, not
  // the account.
  const directRecord = useMemo(() => {
    if (!directHolder || !directOverview || !directIssuedRef) return null;
    const txs = directOverview.transactions ?? [];
    const num = (v) => Number(v) || 0;
    return {
      id: String(id),
      userId: directHolder.user_id,
      name: directHolder.name,
      email: directHolder.email,
      avatarUrl: directHolder.avatar_url ?? null,
      role: directHolder.role,
      referenceId: directIssuedRef.reference_id ?? null,
      referenceLabel: directIssuedRef.reference_label || "",
      status: directIssuedRef.status,
      birStatuses: directIssuedRef.status,
      notes: directIssuedRef.notes ?? null,
      dateCreated: directIssuedRef.created_at ?? null,
      dateClosed: directIssuedRef.date_forwarded ?? null,
      dateCutOff: directIssuedRef.date_cut_off ?? null,
      issued: num(directOverview.totalBudget),
      issuedCount: txs.filter(
        (t) => t.kind === "issued" && t.status !== "cancel",
      ).length,
      openAbono: num(directOverview.totalAbono),
      openAbonoCount: num(directOverview.abonoCount),
      spent: num(directOverview.totalExpenses),
      expenseCount: num(directOverview.expenseCount),
      balance: num(directOverview.totalBalance),
    };
  }, [directHolder, directOverview, directIssuedRef, id]);
  // Display row: the record's own per-record legs when opened by record id,
  // otherwise the legacy per-user aggregates.
  const record = recordMatch ?? directRecord;
  const row = record ?? personnelRow;
  // Review context: the checklist reads the account-level lock
  // (`birStatuses`) from the personnel row but the record's own money/name
  // when a single record is open — the tips then describe this record, not
  // the whole account. A directly-resolved record carries its own status,
  // so its lock follows the record itself.
  const reviewRow =
    recordMatch && personnelRow
      ? {
          ...personnelRow,
          name: record.name,
          openAbono: record.openAbono,
          balance: record.balance,
        }
      : row;
  const [settleOpen, setSettleOpen] = useState(false);

  const backToList = () => nav("/admin/reimbursement");
  const hasOpenAbono = Number(row?.openAbonoCount) > 0;

  // Loading mirror — same frames as the loaded page (back + header,
  // identity + stats hero, checklist + summary rail) so nothing shifts when
  // the record paints. The finalized card is conditional and stays out of
  // the skeleton; the checklist mirror is shared with ReviewSection itself.
  const loadingView = (
    <div
      className="space-y-4 pb-2"
      role="status"
      aria-label="Loading reimbursement detail"
    >
      <div className="flex items-center gap-3">
        <BackButton onClick={backToList} label="Back to reimbursement" />
        <PageHeader
          title="Personnel Reimbursement"
          description="Personnel reimbursement detail."
        />
      </div>
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 lg:grid-cols-4">
          <div
            aria-hidden
            className="flex min-w-0 flex-col gap-2.5 border-b border-[var(--border)] p-4 sm:px-5 lg:border-b-0 lg:border-r lg:p-5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--border)]" />
                <div className="h-3 w-40 max-w-full animate-pulse rounded bg-[var(--border)]" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--border)]" />
              <div className="h-5 w-24 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
          </div>
          <div
            aria-hidden
            className="min-w-0 p-4 sm:p-5 lg:col-span-3"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-card"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-[var(--border)]" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3 w-20 animate-pulse rounded bg-[var(--border)]" />
                      <div className="h-5 w-16 animate-pulse rounded bg-[var(--border)]" />
                      <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--border)]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <ReviewSectionSkeleton />
    </div>
  );

  if (isLoading) {
    return loadingView;
  }

  // Still resolving the issuance row directly by id — hold the skeleton so
  // a finalized record never flashes "not found" first.
  if (!row && directPending) {
    return loadingView;
  }

  if (!row) {
    return (
      <div className="space-y-5 pb-2">
        <div className="flex items-center gap-3">
          <BackButton onClick={backToList} label="Back to reimbursement" />
          <PageHeader
            title="Reimbursement"
            description="Personnel reimbursement detail."
          />
        </div>
        <EmptyState
          icon={Inbox}
          title="No reimbursement record found"
          description="This account holds no open issuance right now."
        />
      </div>
    );
  }

  const labels = (
    record
      ? [record.referenceLabel]
      : String(row.referenceLabels || "").split(",")
  )
    .map((s) => s.trim())
    .filter(Boolean);
  const statuses = (
    record ? [record.status] : String(row.birStatuses || "").split(",")
  )
    .map((s) => s.trim())
    .filter(Boolean);
  // Record mode: this issuance record alone decides read-only. Legacy
  // per-user mode keeps the account rule (closed only when no open issuance
  // is left) — the same rule the review section uses to lock its actions.
  const isClosed = record
    ? record.status === "close"
    : statuses.includes("close") && !statuses.includes("open");
  // Finalized-card context: the finalization date, the display balance and
  // the submit-time issuance note (`budget_issued_reference.notes`, selected
  // per record — legacy per-user aggregates carry no single note, so the
  // note block stays record-only).
  const finalizedDate = record ? record.dateClosed : row.dateClosed;
  const recordNote = (record?.notes ?? "").trim() || null;
  const showRecordNote = isClosed && Boolean(recordNote);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center gap-3">
        <BackButton onClick={backToList} label="Back to reimbursement" />
        <PageHeader
          title="Personnel Reimbursement"
          description="Personnel reimbursement detail."
        />
      </div>

      {isClosed && (
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
                {record
                  ? "Finalized issuance record"
                  : "Reimbursement already closed"}
                <StatusBadge
                  status={record ? record.status : "close"}
                  dot={false}
                />
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                View-only
                {finalizedDate
                  ? ` · finalized ${formatDate(finalizedDate)}`
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
                {record ? record.referenceLabel || "—" : labels[0] || "—"}
              </dd>
            </div>
            <div className="min-w-0 bg-[var(--surface)] px-4 py-3 sm:px-5">
              <dt className="type-eyebrow text-[var(--ink-muted)]">
                Date finalized
              </dt>
              <dd className="mt-1 whitespace-nowrap text-sm font-medium tabular-nums text-[var(--ink)]">
                {finalizedDate ? formatDate(finalizedDate) : "—"}
              </dd>
            </div>
            <div className="min-w-0 bg-[var(--surface)] px-4 py-3 sm:px-5">
              <dt className="type-eyebrow text-[var(--ink-muted)]">
                Balance forwarded
              </dt>
              <dd className="mt-1 whitespace-nowrap font-display text-[15px] font-medium tabular-nums text-[var(--accent-strong)]">
                {formatMoney(row.balance)}
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
                    {recordNote}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}

      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-1 lg:grid-cols-4">
          <div className="flex min-w-0 flex-col gap-2.5 border-b border-[var(--border)] p-4 sm:px-5 lg:border-b-0 lg:border-r lg:p-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <EmployeeAvatar
                name={row.name}
                avatarUrl={row.avatarUrl}
                className="h-10 w-10 shrink-0 text-xs"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-medium tracking-tight text-[var(--ink)]">
                  {row.name || "—"}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {row.email || "No email on file"}
                </p>
              </div>
            </div>

            <span className="flex flex-wrap items-center gap-1">
              {statuses.map((s) => (
                <StatusBadge key={`${row.userId}-${s}`} status={s} dot />
              ))}
              {labels.length > 0 && (
                <span className="contents">
                  {labels.map((label, i) => (
                    <Badge
                      key={`${row.userId}-ref-${i}`}
                      tone="neutral"
                      title={label}
                      className="max-w-full truncate text-xs"
                    >
                      {label}
                    </Badge>
                  ))}
                </span>
              )}
            </span>
          </div>

          <div className="min-w-0 p-4 sm:p-5 lg:col-span-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 xl:grid-cols-4">
              <BalanceStat
                icon={HandCoins}
                label="Issued Budget"
                value={formatMoney(row.issued)}
                hint={
                  record
                    ? `${record.issuedCount ?? 0} transactions · 1 source`
                    : `${row.issuedCount ?? 0} transactions · ${row.referenceCount ?? 0} sources`
                }
                tone="accent"
              />
              <BalanceStat
                icon={Wallet}
                label="Open Abono"
                value={formatMoney(row.openAbono)}
                hint={`${row.openAbonoCount ?? 0} open records`}
                tone={Number(row.openAbono) > 0 ? "warning" : "neutral"}
              />
              <BalanceStat
                icon={ReceiptText}
                label="Total Spent"
                value={formatMoney(row.spent)}
                hint={`${row.expenseCount ?? 0} expenses`}
                tone="neutral"
              />
              <BalanceStat
                icon={PhilippinePesoIcon}
                label="Remaining Balance"
                value={formatMoney(row.balance)}
                hint="Issued + abono − spent"
                tone={Number(row.balance) < 0 ? "danger" : "neutral"}
              />
            </div>
          </div>
        </div>
      </Card>

      <ReviewSection
        employeeId={row.userId}
        recordId={record?.id ?? null}
        row={reviewRow}
        onSettleAbono={() => setSettleOpen(true)}
        hasOpenAbono={hasOpenAbono}
        isClosed={isClosed}
      />
      <SettleAbonoModal
        open={settleOpen}
        employee={row}
        onClose={() => setSettleOpen(false)}
      />
    </div>
  );
}

export default AdminEmployeeReimbursementDetails;
