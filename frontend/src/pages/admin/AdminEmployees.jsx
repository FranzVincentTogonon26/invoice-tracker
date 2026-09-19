import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Clock3,
  Plus,
  Search,
  Users,
  Wallet,
  X,
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
import { Pager } from "../../components/ui/Pager";

import { cn, formatMoney } from "../../lib/utils";
import {
  useEmployees,
  useEmployeesMutations,
  useEmployeesOverview,
} from "../../hooks/useEmployees";

import EmployeesModal from "../../components/layout/admin/employees/EmployeesModal";
import EmployeesTable from "../../components/layout/admin/employees/EmployeesTable";

// Client-side page size — the API returns the full filtered list.
const PAGE_SIZE = 100;

// Status pills mirrored in the employees list API (`status` query param).
const EMPLOYEE_STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "inactive", label: "Inactive" },
];

export default function AdminEmployees() {
  const { data: overview, isLoading: overviewLoading } = useEmployeesOverview();
  const {
    create,
    updateStatus: setAccountStatus,
    remove,
  } = useEmployeesMutations();
  const [addOpen, setAddOpen] = useState(false);

  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  // Debounced copy of `search` so we don't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Filter setters — every filter change also snaps back to the first page.
  const updateStatus = (key) => {
    setStatus(key);
    setPage(0);
  };
  const updateSearch = (value) => {
    setSearch(value);
    setPage(0);
  };

  const {
    data: employees,
    isLoading,
    error,
    refetch,
  } = useEmployees({
    status,
    search: debouncedSearch.trim() || undefined,
  });

  const pageCount = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  // Clamp so a filter change can never land on an out-of-range page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () =>
      employees.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [employees, currentPage],
  );

  const rangeStart = employees.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(employees.length, (currentPage + 1) * PAGE_SIZE);

  // When filters are active the empty state doubles as a "clear filters" affordance.
  const hasActiveFilters = status !== "all" || search.trim().length > 0;
  const clearFilters = () => {
    setStatus("all");
    setSearch("");
    setPage(0);
  };

  // Any in-flight account mutation disables every row action so the table
  // stays consistent while the backend commits a change.
  const actionPending =
    setAccountStatus.isPending || remove.isPending || create.isPending;

  const handleAction = async (action, employee) => {
    try {
      if (action === "approve" || action === "activate") {
        await setAccountStatus.mutateAsync({
          id: employee.user_id,
          status: "active",
        });
        toast.success(`${employee.name} is now active.`);
      } else if (action === "deactivate") {
        await setAccountStatus.mutateAsync({
          id: employee.user_id,
          status: "inactive",
        });
        toast.success(`${employee.name} has been deactivated.`);
      } else if (action === "delete") {
        await remove.mutateAsync(employee.user_id);
        toast.success(`${employee.name} removed from the roster.`);
      }
    } catch (err) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage employee accounts and monitor their budget activity."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Button variant="accent" onClick={() => setAddOpen(true)}>
              <Plus size={16} /> Add Employee
            </Button>
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
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Total Budget Issued"
            value={formatMoney(overview.totalEmployeeIssued)}
            icon={Wallet}
            accent
            breakdownCaption="Across all employees"
            loading={overviewLoading}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Total Employees"
            value={overview.totalEmployees}
            icon={Users}
            loading={overviewLoading}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Active Employees"
            value={overview.activeEmployees}
            icon={BadgeCheck}
            tone="success"
            loading={overviewLoading}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            show: {
              opacity: 1,
              y: 0,
              transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="h-full [&>div]:h-full"
        >
          <StatCard
            label="Pending Approval"
            value={overview.pendingApproval}
            icon={Clock3}
            tone="warning"
            loading={overviewLoading}
          />
        </motion.div>
      </motion.div>

      <Card
        padding="lg"
        className="relative overflow-hidden rounded-3xl px-2 sm:px-6"
      >
        <CardHeader>
          <div>
            <CardTitle className="text-lg">All Employees</CardTitle>
            <CardDescription className="text-sm">
              Approve pending sign-ups, activate or deactivate accounts, and
              keep an eye on each employee&apos;s issued budget.
            </CardDescription>
          </div>
          {!isLoading && employees.length > 0 && (
            <Badge tone="neutral" className="shrink-0">
              {employees.length}{" "}
              {employees.length === 1 ? "employee" : "employees"}
            </Badge>
          )}
        </CardHeader>

        {/* Search + status filter — compact controls consistent with the
            Budget Transactions card */}
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-1 sm:w-fit">
            {EMPLOYEE_STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => updateStatus(t.key)}
                className={cn(
                  "h-8 rounded-full px-4 text-sm font-semibold transition-colors",
                  status === t.key
                    ? "bg-[var(--ink)] text-[var(--bg)]"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="lg:ml-auto lg:w-[320px]">
            <SearchInput
              leftIcon={<Search size={16} />}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => updateSearch(e.target.value)}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => updateSearch("")}
                    aria-label="Clear search"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                  >
                    <X size={14} />
                  </button>
                ) : null
              }
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton rows={6} showAvatar />
        ) : error ? (
          <ErrorState
            title="Couldn't load employees"
            message="Something went wrong while fetching the employee roster."
            onRetry={refetch}
            onClearFilters={hasActiveFilters ? clearFilters : undefined}
          />
        ) : pageRows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              hasActiveFilters
                ? "No employees match your filters"
                : "No employees yet"
            }
            message={
              hasActiveFilters
                ? "Try a different status or search term."
                : 'Use the "Add Employee" button to create the first account.'
            }
            onClear={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            <EmployeesTable
              rows={pageRows}
              pending={actionPending}
              onAction={handleAction}
            />

            {/* Footer — "Showing X–Y of N" and pagination */}
            <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center">
              <p className="text-sm text-[var(--ink-muted)]">
                Showing {rangeStart}–{rangeEnd} of {employees.length}{" "}
                {employees.length === 1 ? "employee" : "employees"}
              </p>
              {pageCount > 1 && (
                <Pager
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              )}
            </div>
          </>
        )}
      </Card>

      <EmployeesModal
        open={addOpen}
        create={create}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
}
