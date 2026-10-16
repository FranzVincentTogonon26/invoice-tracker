import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  HandCoins,
  Inbox,
  Lock,
  LockOpen,
  MessageCircleQuestionMark,
  PhilippinePesoIcon,
  ReceiptText,
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
import {
  reimbursementOverviewKey,
  useReimbursementOverview,
} from "../../../../hooks/useEmployeeReimbursement";
import { budgetsApi } from "../../../../api/budget";
import ConfirmActionDialog from "../expenses/ConfirmActionDialog";
import {
  useEmployeeDetailsExpenses,
  useEmployeeDetailsOverview,
  useIssuanceHolder,
} from "../../../../hooks/useEmployeeDetails";
import { RecordActionsMenu } from "./RecordActionsMenu";
import { ReimbursementPreviewModal } from "./ReimbursementPreviewModal";

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
      sent: num(directOverview.totalSent),
      received: num(directOverview.totalReceived),
      settledAbono: num(directOverview.totalSettledAbono),
      balance: num(directOverview.totalBalance),
    };
  }, [directHolder, directOverview, directIssuedRef, id]);
  // Display row: the record's own per-record legs when opened by record id,
  // otherwise the legacy per-user aggregates.
  const record = recordMatch ?? directRecord;
  const row = record ?? personnelRow;
  // Preview expense list — hooked unconditionally at top level (never inside
  // the preview conditional below): a hook mounted only while the modal is
  // open changes the hook count between renders ("Rendered more hooks").
  // Null id keeps the query idle until a record resolves.
  const previewExpId = record?.id ?? row?.userId ?? null;
  const previewExpView = record?.id ? "reimbursement" : undefined;
  const { expenses: previewTxns, isLoading: previewTxLoading } =
    useEmployeeDetailsExpenses(previewExpId, previewExpView);
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
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reopen: flips this finalized record back to 'open' (undo of the
  // submit). Refreshes every surface that reads issuance status.
  const qc = useQueryClient();
  const reopen = useMutation({
    mutationFn: (recordId) => budgetsApi.reopenIssuedReference(recordId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reimbursementOverviewKey });
      qc.invalidateQueries({ queryKey: ["employeeDetails"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
      setReopenConfirmOpen(false);
      toast.success("Reimbursement reopened — the record is open again.");
    },
    onError: (err) => {
      toast.error(err?.message || "Couldn't reopen this reimbursement.");
      setReopenConfirmOpen(false);
    },
  });

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
          <div aria-hidden className="min-w-0 p-4 sm:p-5 lg:col-span-3">
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
  // Reopen would fail server-side (409) when the employee already holds a
  // live sibling issuance for this source — detect it upfront so the menu
  // never offers a doomed confirm. Plain derivation (no hook): it must run
  // before the early returns below.
  const liveSibling = (() => {
    if (!record || record.status !== "close") return false;
    const refId = String(record.referenceId ?? record.reference_id ?? "");
    const userId = String(record.userId ?? record.user_id ?? "");
    return (records ?? []).some(
      (r) =>
        String(r.id) !== String(record.id) &&
        String(r.referenceId ?? r.reference_id ?? "") === refId &&
        String(r.userId ?? r.user_id ?? "") === userId &&
        String(r.status ?? "").trim().toLowerCase() === "open",
    );
  })();
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
          className="overflow-visible rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-card"
        >
          <div className="flex items-center gap-3 rounded-t-3xl border-b border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3 sm:px-5">
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
            <RecordActionsMenu
              canReopen={Boolean(record?.id) && !liveSibling}
              onReopen={() => setReopenConfirmOpen(true)}
              onPreview={() => setPreviewOpen(true)}
            />
          </div>
          {record && liveSibling && (
            <p
              role="note"
              className="border-b border-[var(--border)] bg-[var(--warning)]/[0.07] px-4 py-2.5 text-xs leading-snug text-[var(--warning)] sm:px-5"
            >
              Reopen unavailable — {row?.name || "this employee"} already holds
              an open issuance for this source. Reimburse it first.
            </p>
          )}
          <dl
            className={`grid grid-cols-1 gap-px bg-[var(--border)]/60 sm:grid-cols-3 ${
              showRecordNote ? "" : "overflow-hidden rounded-b-3xl"
            }`}
          >
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
            <div className="rounded-b-3xl border-t border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)]/40 px-3.5 py-3">
                <MessageCircleQuestionMark
                  size={16}
                  className="mt-0.5 shrink-0 text-[var(--accent-strong)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed  text-[var(--accent-strong)]">
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
                received={Number(row?.received) || 0}
                sent={Number(row?.sent) || 0}
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
                hint="Issued + abono − spent − sent + received"
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
      <ConfirmActionDialog
        open={reopenConfirmOpen}
        icon={<LockOpen size={20} aria-hidden />}
        iconClassName="bg-[var(--accent-soft)] text-[var(--accent-strong)]"
        title="Reopen reimbursement?"
        description="Do you want to open this reimbursement transactions? Its status returns to open, its money counts again, and the checklist unlocks."
        summary={
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
            <EmployeeAvatar
              name={row?.name}
              avatarUrl={row?.avatarUrl}
              className="h-10 w-10 shrink-0 text-sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-[var(--ink)]">
                {row?.name || "This record"}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                {record?.referenceLabel || labels[0] || "Issuance record"} ·{" "}
                {formatMoney(row?.balance ?? 0)} balance
              </p>
            </div>
          </div>
        }
        cancelLabel="Keep closed"
        confirmLabel="Yes, reopen it"
        confirmVariant="accent"
        pendingLabel="Reopening…"
        pending={reopen.isPending}
        onCancel={() => {
          if (!reopen.isPending) setReopenConfirmOpen(false);
        }}
        onConfirm={() => {
          if (record?.id && !reopen.isPending) reopen.mutate(record.id);
        }}
      />
      <ReimbursementPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        row={row}
        labels={labels}
        finalizedDate={finalizedDate}
        recordNote={recordNote}
        txns={previewTxns}
        txLoading={previewTxLoading}
      />
    </div>
  );
}

export default AdminEmployeeReimbursementDetails;
