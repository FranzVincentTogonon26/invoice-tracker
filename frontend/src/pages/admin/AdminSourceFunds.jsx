import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
} from "../../components/ui/DataState";
import ConfirmActionDialog from "../../components/layout/admin/expenses/ConfirmActionDialog";
import { SourceCreateModal } from "../../components/layout/admin/source-of-funds/SourceCreateModal";
import {
  useSourceFunds,
  useSourceFundsMutations,
} from "../../hooks/useSourceFunds";
import { formatMoney, toMoney } from "../../lib/utils";
import { SourceStats } from "../../components/layout/admin/source-of-funds/SourceStats";
import { SourceFilters } from "../../components/layout/admin/source-of-funds/SourceFilters";
import { SourceTable } from "../../components/layout/admin/source-of-funds/SourceTable";
import { SourceEditModal } from "../../components/layout/admin/source-of-funds/SourceEditModal";

const PAGE_SIZE = 50;

export default function AdminSourceFunds() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [editSource, setEditSource] = useState(null);
  const [deleteSource, setDeleteSource] = useState(null);
  const [refsOpen, setRefsOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Nests under ["budgets", "sources"] — covered by the shared budget
  // invalidation plus the realtime bridge, so edits stream in live.
  const params = useMemo(
    () => ({ search: debouncedSearch.trim() || undefined }),
    [debouncedSearch],
  );
  const { sources, isLoading, error, refetch } = useSourceFunds(params);
  const { createReference, updateReference, removeReference } =
    useSourceFundsMutations();

  const rows = useMemo(() => {
    const list = sources ?? [];
    return status === "all"
      ? list
      : list.filter((s) => (s.status ?? "open") === status);
  }, [sources, status]);

  const totals = useMemo(() => {
    const sum = (pick) =>
      toMoney(rows.reduce((acc, r) => acc + Number(pick(r) || 0), 0));
    return {
      allocated: sum((r) => r.allocated),
      remaining: sum((r) => r.remaining),
      issued: sum((r) => r.issued),
      expenses: sum((r) => r.expenses),
      transactions: rows.reduce(
        (acc, r) => acc + (Number(r.transactions) || 0),
        0,
      ),
    };
  }, [rows]);

  // Per-card sparklines — top sources by allocated, so a handful of bars
  // never stretches across the lane.
  const sparks = useMemo(() => {
    const top = [...rows]
      .sort((a, b) => Number(b.allocated || 0) - Number(a.allocated || 0))
      .slice(0, 8);
    return {
      allocated: top.map((r) => ({ v: toMoney(r.allocated) })),
      remaining: top.map((r) => ({ v: toMoney(r.remaining) })),
      used: top.map((r) => ({ v: toMoney(r.issued + r.expenses) })),
      transactions: top.map((r) => ({ v: Number(r.transactions) || 0 })),
    };
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [rows, currentPage],
  );
  const rangeStart = rows.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(rows.length, (currentPage + 1) * PAGE_SIZE);

  const hasActiveFilters =
    debouncedSearch.trim().length > 0 || status !== "all";
  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("all");
    setPage(0);
  };

  // View details opens the dedicated overview route (deep-linkable via
  // ?ref=) instead of a modal.
  const handleView = (source) => {
    if (!source?.reference_id) return;
    nav(`/admin/source-funds/overview?ref=${source.reference_id}`, {
      state: { referenceId: source.reference_id },
    });
  };

  const handleEditSave = async (source, payload) => {
    try {
      await updateReference.mutateAsync({
        referenceId: source.reference_id,
        payload,
      });
      setEditSource(null);
      // Actor-only toast: this admin's device confirms; other sessions
      // refresh silently over the socket.
      toast.success(`Source "${payload.label ?? source.label}" saved.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't save the source.");
    }
  };

  const handleCreate = async ({ label, notes }) => {
    try {
      await createReference.mutateAsync({ label, notes });
      setRefsOpen(false);
      // Actor-only toast: this admin's device confirms; other sessions
      // refresh silently over the socket.
      toast.success(`Source "${label}" created.`);
    } catch (err) {
      toast.error(err?.message || "Couldn't create the source.");
    }
  };

  const handleDelete = async () => {
    if (!deleteSource) return;
    try {
      await removeReference.mutateAsync(deleteSource.reference_id);
      setDeleteSource(null);
      toast.success("Source deleted with all its records.");
    } catch (err) {
      toast.error(err?.message || "Couldn't delete the source.");
    }
  };

  const deleteSummary = deleteSource ? (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-[var(--ink)]">
          {deleteSource.label || "Untitled source"}
        </p>
        <p className="mt-0.5 truncate text-xs tabular-nums text-[var(--ink-muted)]">
          {formatMoney(deleteSource.allocated)} allocated ·{" "}
          {Number(deleteSource.transactions) || 0} transactions
        </p>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Source of Funds"
        description="Tracks the origin of funds used for expenses and budget allocations."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto justify-end">
            <Button variant="accent" onClick={() => setRefsOpen(true)}>
              <Plus size={16} /> Add Source
            </Button>
          </div>
        }
      />

      <SourceStats totals={totals} sparks={sparks} isLoading={isLoading} />

      <Card
        padding="lg"
        className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
      >
        <CardHeader>
          <div>
            <CardTitle className="text-lg">All Sources</CardTitle>
            <CardDescription className="text-sm">
              Open and closed sources — closing disconnects a source from every
              flow until reopened.
            </CardDescription>
          </div>
          {!isLoading && rows.length > 0 && (
            <Badge tone="neutral" className="shrink-0 tabular-nums">
              {rows.length} {rows.length === 1 ? "source" : "sources"}
            </Badge>
          )}
        </CardHeader>

        <SourceFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(0);
          }}
          status={status}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
        />

        {isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <ErrorState
            title="Couldn't load sources"
            message="Something went wrong while fetching budget sources."
            onRetry={refetch}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={
              hasActiveFilters
                ? "No sources match your filters"
                : "No budget sources yet"
            }
            message={
              hasActiveFilters
                ? "Try a different status or search term."
                : 'Use "Add Source" to create the first one.'
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <SourceTable
            pageRows={pageRows}
            rows={rows}
            currentPage={currentPage}
            pageCount={pageCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onView={handleView}
            onEdit={setEditSource}
            onDelete={setDeleteSource}
          />
        )}
      </Card>

      {editSource && (
        <SourceEditModal
          source={editSource}
          saving={updateReference.isPending}
          onClose={() => {
            if (!updateReference.isPending) setEditSource(null);
          }}
          onSave={handleEditSave}
        />
      )}
      <SourceCreateModal
        open={refsOpen}
        saving={createReference.isPending}
        onClose={() => {
          if (!createReference.isPending) setRefsOpen(false);
        }}
        onSave={handleCreate}
      />
      <ConfirmActionDialog
        open={Boolean(deleteSource)}
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this source?"
        description="Permanently removes the source and every record under it (top-ups, issuances, linked rows cascade). This can't be undone."
        summary={deleteSummary}
        cancelLabel="Keep source"
        confirmLabel="Yes, delete it"
        pendingLabel="Deleting…"
        pending={removeReference.isPending}
        onCancel={() => {
          if (!removeReference.isPending) setDeleteSource(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
