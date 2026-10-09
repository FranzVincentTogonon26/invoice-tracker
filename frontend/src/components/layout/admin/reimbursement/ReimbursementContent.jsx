import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  HandCoins,
  Inbox,
  PhilippinePesoIcon,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { PageHeader } from "../../../ui/PageHeader";
import { Badge, StatusBadge } from "../../../ui/Badge";
import { Card } from "../../../ui/Card";
import { EmptyState, LoadingSkeleton } from "../../../ui/DataState";
import { EmployeeAvatar } from "../../../ui/SelectEmployee";
import { BackButton } from "../employees/EmployeeDetailsHeader";
import { SettleAbonoModal } from "./SettleAbonoModal";
import { BalanceStat } from "./BalanceStat";
import { ReviewSection } from "./ReviewSection";
import { formatMoney } from "@/lib/utils";
import { useReimbursementOverview } from "../../../../hooks/useEmployeeReimbursement";

// Admin → Reimbursement → personnel row → per-employee detail (route
// `reimbursement/:id`). Reads the same fund-pool overview as the list and
// expands the matching personnel ledger row: identity, balance hero stats
// and source/status context. Someone with no open issuance resolves to an
// empty state instead of a broken page.
//
// Heavy pieces live in siblings: BalanceStat (stat tile), ReviewSection
// (checklist + summary + dialogs) and SettleAbonoModal. Pure review rules
// live in @/lib/reimbursement.
export function AdminEmployeeReimbursementDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, isLoading } = useReimbursementOverview();

  const personnel = data?.personnel ?? [];
  const row = personnel.find((r) => String(r.userId) === String(id)) ?? null;
  const [settleOpen, setSettleOpen] = useState(false);

  const backToList = () => nav("/admin/reimbursement");
  const hasOpenAbono = Number(row?.openAbonoCount) > 0;

  if (isLoading) {
    return (
      <div className="space-y-5 pb-2">
        <PageHeader
          title="Employee Reimbursement"
          description="Personnel reimbursement detail."
        />
        <LoadingSkeleton rows={5} />
      </div>
    );
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

  const labels = String(row.referenceLabels || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const statuses = String(row.birStatuses || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex items-center gap-3">
        <BackButton onClick={backToList} label="Back to reimbursement" />
        <PageHeader
          title="Personnel Reimbursement"
          description="Personnel reimbursement detail."
        />
      </div>

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
                hint={`${row.issuedCount ?? 0} transactions · ${row.referenceCount ?? 0} sources`}
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
        employeeId={id}
        row={row}
        onSettleAbono={() => setSettleOpen(true)}
        hasOpenAbono={hasOpenAbono}
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
