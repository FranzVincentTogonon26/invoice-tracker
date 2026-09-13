import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar1Icon,
  Loader2,
  PhilippinePesoIcon,
  WalletIcon,
  AlertCircle,
  Lock,
  X,
  Plus,
} from "lucide-react";
import { Input, TextArea } from "../../../ui/Input";
import { Badge } from "../../../ui/Badge";
import { Select } from "../../../ui/Select";
import { SelectEmployee } from "../../../ui/SelectEmployee";
import { SelectReference } from "../../../ui/SelectReference";
import { Button } from "../../../ui/Button";
import ReferencesModal from "./ReferencesModal";
import { useBudgetBalance } from "../../../../hooks/useBudget";
import useSmoothScroll from "../../../../hooks/useSmoothScroll";
import { formatMoney } from "../../../../lib/utils";
import toast from "react-hot-toast";

// Approver is fixed for now (admin-issued budgets are always self-approved)
const APPROVER = "Franz Vincent";

const initialForm = {
  reference_id: "",
  employee: "",
  amount: "",
  method: "",
  description: "",
  note: "",
};

// Soft client-side length caps for the text areas (the backend has no hard
// limit; these keep entries tidy and power the live character counters).
const DESCRIPTION_MAX = 200;
const NOTE_MAX = 150;

// Error banners auto-dismiss after this long (ms); AnimatePresence plays the
// smooth fade/slide/height-collapse exit when the message clears.
const ERROR_VISIBLE_MS = 5000;

// Quick-fill amounts for the money input — one tap fills the field, avoiding
// typos on numeric keyboards. Values match common budget tranches.
const AMOUNT_PRESETS = [500, 1000, 2500, 5000];

function Field({ label, optional, hint, children, count, max }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
          {label}
          {optional && (
            <span className="ml-1.5 normal-case tracking-normal font-normal text-[10px] opacity-70">
              · optional
            </span>
          )}
        </span>
        {max != null && (
          <span
            className={`text-[10px] tabular ${
              (count ?? 0) >= max
                ? "text-[var(--warning)]"
                : "text-[var(--ink-muted)] opacity-70"
            }`}
          >
            {count ?? 0}/{max}
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[11px] font-normal leading-snug text-[var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

// Compact read-only context strip — fixed metadata (date, approver) shown as
// one summary card instead of stacked display rows, so users don't click
// expecting to type (borderless controls, muted subtitle, non-interactive)
function ContextCard({ icon, title, subtitle, badge, badgeTone = "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3 shadow-card">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        {subtitle && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {badge && <Badge tone={badgeTone}>{badge}</Badge>}
    </div>
  );
}

// Live balance readout for the issuedBudget flow — fetches the selected
// reference's allocated (budget rows) vs issued (issued_budget rows) amounts
// and renders the remaining balance. Three visual states:
//   1. no selection → dashed hint card ("select a source to see balance")
//   2. loading      → skeleton pulse (no layout shift)
//   3. loaded       → headline balance + allocated/issued grid breakdown,
//                     degrading to a warning treatment when fully depleted
function BalanceCard({ summary, isLoading, referenceId, projection, exceeds }) {
  const EMPTY = { allocated: 0, issued: 0, balance: 0 };

  if (!referenceId) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)]">
          <WalletIcon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--ink-muted)]">
            Balance
          </p>
          <p className="text-xs leading-snug text-[var(--ink-muted)]">
            Select a budget source to view its remaining balance.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 px-3.5 py-3 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--border)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 animate-pulse rounded bg-[var(--border)]" />
            <div className="h-6 w-36 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      </div>
    );
  }

  const { allocated, issued, balance } = summary ?? EMPTY;
  const depleted = balance <= 0;

  return (
    <div
      className={`rounded-2xl border px-3.5 py-3 shadow-card ${
        exceeds
          ? "border-[var(--danger)]/30 bg-[var(--danger)]/10"
          : depleted
            ? "border-[var(--warning)]/30 bg-[var(--warning)]/10"
            : "border-[var(--border)] bg-[var(--surface-2)]/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-1 ring-[var(--surface)]">
          <WalletIcon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Balance
          </p>
          <p
            className={`flex items-center gap-1 text-2xl font-semibold tracking-tight tabular ${
              exceeds
                ? "text-[var(--danger)]"
                : depleted
                  ? "text-[var(--warning)]"
                  : "text-[var(--ink)]"
            }`}
          >
            <PhilippinePesoIcon size={20} className="shrink-0 opacity-70" />
            {Number(balance).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <Badge tone={exceeds || depleted ? "warning" : "accent"}>
          {exceeds ? "Insufficient" : depleted ? "Depleted" : "Funded"}
        </Badge>
      </div>

      {/* Breakdown: allocated vs already-issued, side by side on a grid */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Allocated
          </p>
          <p className="truncate text-sm font-semibold tabular">
            {formatMoney(allocated)}
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Issued
          </p>
          <p className="truncate text-sm font-semibold tabular">
            {formatMoney(issued)}
          </p>
        </div>
      </div>

      {/* Live projection: balance minus the amount currently typed. Slides in
          only once a valid amount is entered; red when it would over-issue. */}
      <AnimatePresence initial={false}>
        {projection != null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
                After this issue
              </p>
              <p
                className={`truncate text-sm font-semibold tabular ${
                  projection > balance
                    ? "text-[var(--danger)]"
                    : "text-[var(--accent-strong)]"
                }`}
              >
                {formatMoney(balance - projection)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Money input with a live formatted peso preview and one-tap quick-fill
// presets — confirms the parsed amount at a glance and avoids typos on
// numeric keyboards. Kept here (not in ui/) since it is budget-form specific.
function AmountInput({ value, onChange, disabled }) {
  const parsed = Number(value);
  const preview =
    String(value ?? "").trim() !== "" && !Number.isNaN(parsed)
      ? parsed.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
      : null;

  return (
    <div>
      <Input
        value={value}
        onChange={onChange}
        min="0"
        step="0.01"
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        disabled={disabled}
        Icon={PhilippinePesoIcon}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={`truncate text-[11px] font-medium tabular leading-snug ${
            preview ? "text-[var(--accent-strong)]" : "text-[var(--ink-muted)]"
          }`}
        >
          {preview ?? "Philippine peso (₱)"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ target: { value: String(preset) } })}
              className="h-6 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 text-[10px] font-semibold tabular text-[var(--ink-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--accent-strong)] disabled:opacity-50"
            >
              ₱{preset.toLocaleString("en-PH")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Amount field with a reference lock — the input (and its quick-fill presets)
// stay disabled until a budget reference is chosen, so an amount can never be
// entered against a non-existent source. Interactions while locked trigger a
// toast nudge plus an inline animated hint explaining what's missing.
// `children` renders extra live warnings (e.g. the over-balance alert).
function AmountField({ value, onChange, saving, locked, children }) {
  return (
    <Field label="Amount">
      <div
        onClick={
          locked
            ? () =>
                toast.error(
                  "Select a budget reference first, then enter an amount.",
                  { id: "amount-locked" },
                )
            : undefined
        }
        className={locked ? "cursor-not-allowed" : undefined}
      >
        <AmountInput
          value={value}
          onChange={onChange}
          disabled={saving || locked}
        />
        <AnimatePresence initial={false}>
          {locked && (
            <motion.div
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="status"
              className="flex items-start gap-2 overflow-hidden text-xs text-[var(--warning)] bg-[var(--warning)]/10 border border-[var(--warning)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-1.5"
            >
              <Lock size={14} className="mt-px shrink-0" />
              <span>
                Locked — select a budget source first to enable the amount
                input.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </div>
    </Field>
  );
}

const BudgetModal = ({
  open,
  transaction,
  onClose,
  create,
  employees = [],
  budgetReferences = [],
}) => {
  const [form, setForm] = useState(initialForm);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const [references, setReferences] = useState(budgetReferences);
  const [refsOpen, setRefsOpen] = useState(false);

  // Sync local list with the prop during render (same pattern as `prevOpen`
  // below) — avoids a cascading re-render from setState-in-effect.
  const [prevRefs, setPrevRefs] = useState(budgetReferences);
  if (budgetReferences !== prevRefs) {
    setPrevRefs(budgetReferences);
    setReferences(budgetReferences);
  }

  const addReference = async (created) => {
    setReferences((prev) => [created, ...prev]);
    setForm((f) => ({ ...f, reference_id: created.reference_id }));
  };

  const removeReference = (referenceId) => {
    setReferences((prev) => prev.filter((r) => r.reference_id !== referenceId));
    setForm((f) =>
      f.reference_id === referenceId ? { ...f, reference_id: "" } : f,
    );
  };

  const refsOpenRef = useRef(false);
  useEffect(() => {
    refsOpenRef.current = refsOpen;
  }, [refsOpen]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setForm({ ...initialForm });
    setErr("");
    setSaving(false);
    setRefsOpen(false);
  }

  const handleClose = () => {
    if (saving) return;

    setForm({ ...initialForm });
    setErr("");
    setRefsOpen(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e) => {
      if (refsOpenRef.current) return;
      if (e.key === "Escape" && !saving) {
        setForm({ ...initialForm });
        setErr("");
        setRefsOpen(false);
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving, onClose]);

  const isAddBudget = transaction === "addBudget";

  // issuedBudget flow: fetch the selected reference's balance (allocated vs
  // issued vs remaining) as soon as a reference is chosen. Key nests under
  // ["budgets"] so the create/remove mutations invalidate it automatically.
  const balanceQuery = useBudgetBalance(form.reference_id, !isAddBudget);

  // Smooth eased wheel scrolling for the modal body (scrub feel)
  const bodyRef = useSmoothScroll();

  // Auto-reveal errors: when an error appears (validation or server failure),
  // scroll the body until the WHOLE banner is visible. The banner animates
  // its height in (framer-motion), so a one-shot scrollIntoView measures it
  // at height 0 and leaves the message clipped below — instead we nudge the
  // container across several frames until the banner's edges settle fully
  // inside the visible area. Only the modal container is scrolled (never the
  // page behind the modal).
  const errRef = useRef(null);
  useEffect(() => {
    if (!err) return undefined;
    const container = bodyRef.current;
    if (!container) return undefined;

    const margin = 16; // breathing room around the banner
    let rafId = null;
    let frames = 0;
    let settled = 0;

    // Per-frame scrollTop math must not use CSS smooth-scrolling, or each
    // nudge restarts an animation and never converges.
    container.style.scrollBehavior = "auto";

    const step = () => {
      const banner = errRef.current;
      if (banner) {
        const cRect = container.getBoundingClientRect();
        const bRect = banner.getBoundingClientRect();

        // Clipped below the visible area → scroll down by the deficit
        if (bRect.bottom + margin > cRect.bottom) {
          container.scrollTop += bRect.bottom + margin - cRect.bottom;
        }
        // Clipped above the visible area → scroll up by the deficit
        if (bRect.top - margin < cRect.top) {
          container.scrollTop -= cRect.top - (bRect.top - margin);
        }

        // Fully visible for 2 consecutive frames → done early. Otherwise the
        // banner is still growing (mount animation) and needs more nudges.
        const fullyVisible =
          bRect.top - margin >= cRect.top &&
          bRect.bottom + margin <= cRect.bottom;
        settled = fullyVisible ? settled + 1 : 0;
      }

      frames += 1;
      // Cap at ~1s of frames — covers the banner's mount animation with slack
      if (settled < 2 && frames < 60) rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      container.style.scrollBehavior = "";
    };
  }, [err]);

  // Auto-dismiss: clear the error after ERROR_VISIBLE_MS so stale messages
  // don't linger. Restarted every time a new error appears; clearing triggers
  // the smooth exit animation below via AnimatePresence.
  useEffect(() => {
    if (!err) return undefined;

    const id = setTimeout(() => setErr(""), ERROR_VISIBLE_MS);
    return () => clearTimeout(id);
  }, [err]);

  // Live over-balance feedback for the amount input (issuedBudget flow).
  // The typed amount is compared against the fetched remaining balance:
  // exceeding it shows an inline warning under the input, tints the balance
  // card and turns the "After this issue" projection negative. Submitting
  // still runs the full validation guard + error banner.
  const amountNum = Number(form.amount);
  const amountEntered =
    String(form.amount ?? "").trim() !== "" &&
    !Number.isNaN(amountNum) &&
    amountNum > 0;
  const remaining = Number(balanceQuery.data?.balance ?? 0);
  const exceedsBalance =
    !isAddBudget &&
    balanceQuery.isSuccess &&
    amountEntered &&
    amountNum > remaining;
  const projection = !isAddBudget && amountEntered ? amountNum : null;

  // Amount stays locked until a budget reference is selected — applies to
  // BOTH flows (addBudget + issuedBudget), since submit validation requires
  // the source first. Clicking the locked field nudges with a toast + hint.
  const amountLocked = !form.reference_id;

  // Client-side validation mirroring `POST /budgets` zod rules
  const validate = () => {
    if (isAddBudget && !form.reference_id)
      return "Please select a budget reference first.";
    if (!form.employee && !isAddBudget)
      return "Please select an employee first.";
    if (!form.method) return "Please select a payment method.";
    if (!form.description || form.description.trim().length < 2)
      return "Description is required.";
    if (!String(form.amount).trim()) return "Amount is required.";

    const amount = Number(form.amount);
    if (Number.isNaN(amount)) return "Amount must be a valid number.";
    if (amount <= 0) return "Amount must be greater than zero.";

    // issuedBudget: block over-issuing past the selected reference's
    // remaining balance (only enforced once the balance query has data)
    if (!isAddBudget && balanceQuery.isSuccess) {
      const remaining = Number(balanceQuery.data?.balance ?? 0);
      if (amount > remaining)
        return `Amount exceeds the remaining balance of ${formatMoney(
          remaining,
        )} for this budget source.`;
    }

    return "";
  };

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const validationError = validate();
    if (validationError) {
      setErr(validationError);
      return;
    }

    setSaving(true);
    try {
      const body = isAddBudget
        ? {
            type: "addBudget",
            reference_id: form.reference_id,
            amount: form.amount,
            method: form.method,
            description: form.description,
            approved: APPROVER,
          }
        : {
            type: "issuedBudget",
            reference_id: form.reference_id,
            employeeId: form.employee,
            amount: form.amount,
            method: form.method,
            description: form.description,
            note: form.note,
          };

      await create.mutateAsync(body);
      setForm({ ...initialForm });
      setErr("");
      onClose();
      toast.success(
        isAddBudget
          ? "Budget added successfully!"
          : "Budget issued successfully!",
      );
    } catch (error) {
      setErr(error?.message || "Couldn't save budget");
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-[var(--ink)]/40 backdrop-blur-sm flex items-center justify-center">
            <motion.form
              onSubmit={onSubmit}
              onClick={(e) => e.stopPropagation()}
              aria-labelledby="budget-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex w-full max-w-[500px] flex-col max-h-[calc(100dvh-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-hover p-6 sm:p-7"
            >
              <div className="flex shrink-0 items-start justify-between mb-6">
                <div className="min-w-0">
                  <h3
                    id="budget-modal-title"
                    className="font-display text-lg font-semibold tracking-tight"
                  >
                    {transaction === "addBudget"
                      ? "Add Budget"
                      : "Issued Budget"}
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-[var(--ink-muted)]">
                    {transaction === "addBudget"
                      ? "Top up a budget reference with new funds."
                      : "Allocate funds from a budget reference to an employee."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable body — header and footer stay pinned; only this
                  area scrolls when the form grows past the viewport */}
              <div
                ref={bodyRef}
                className="scrollbar-slim min-h-0 flex-1 overflow-y-auto"
              >
                {transaction === "addBudget" ? (
                  <div className="space-y-5">
                    {/* Read-only context strip: date + approver, collapsed into one
                      summary card instead of two stacked display rows */}
                    <ContextCard
                      icon={
                        <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] font-semibold text-sm flex items-center justify-center ring-1 ring-[var(--surface)]">
                          {APPROVER.charAt(0)}
                        </div>
                      }
                      title={APPROVER}
                      subtitle={
                        <span className="flex items-center gap-1.5">
                          <Calendar1Icon size={11} className="shrink-0" />
                          {today}
                        </span>
                      }
                      badge="Approver"
                    />
                    <Field
                      label="Budget Reference"
                      hint="Select the budget reference (source and date)."
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <SelectReference
                            references={references}
                            value={form?.reference_id}
                            onChange={set("reference_id")}
                            placeholder="Select budget source"
                            disabled={saving}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="soft"
                          size="icon"
                          onClick={() => setRefsOpen(true)}
                          disabled={saving}
                          aria-label="Add new reference"
                          title="Add new reference"
                        >
                          <Plus size={16} />
                        </Button>
                      </div>
                    </Field>
                    <AmountField
                      value={form?.amount}
                      onChange={set("amount")}
                      saving={saving}
                      locked={amountLocked}
                    />
                    <Field label="Transaction Method">
                      <Select
                        value={form?.method}
                        onChange={set("method")}
                        placeholder="Select transaction method"
                        disabled={saving}
                      />
                    </Field>
                    <Field label="Description">
                      <TextArea
                        value={form?.description}
                        onChange={set("description")}
                        placeholder="What was this for?"
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Read-only context strip: today's issuance date */}
                    <ContextCard
                      icon={
                        <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] flex items-center justify-center ring-1 ring-[var(--surface)]">
                          <Calendar1Icon size={15} />
                        </div>
                      }
                      title={today}
                      subtitle="Issuance date"
                      badge="Today"
                      badgeTone="accent"
                    />

                    <BalanceCard
                      summary={balanceQuery.data}
                      isLoading={
                        balanceQuery.isLoading || balanceQuery.isFetching
                      }
                      referenceId={form.reference_id}
                      projection={projection}
                      exceeds={exceedsBalance}
                    />

                    <Field
                      label="Budget Reference"
                      hint="Select the budget reference (source and date)."
                    >
                      <SelectReference
                        references={references}
                        value={form?.reference_id}
                        onChange={set("reference_id")}
                        placeholder="Select budget source"
                        disabled={saving}
                      />
                    </Field>
                    <Field
                      label="Employee"
                      hint="The budget will be issued to this employee."
                    >
                      <SelectEmployee
                        employees={employees}
                        value={form?.employee}
                        onChange={set("employee")}
                        placeholder="Select employee"
                        disabled={saving}
                      />
                    </Field>
                    <AmountField
                      value={form?.amount}
                      onChange={set("amount")}
                      saving={saving}
                      locked={amountLocked}
                    >
                      {/* Live over-balance warning — appears as soon as the
                        typed amount exceeds the remaining balance, so the
                        user is told before hitting submit */}
                      <AnimatePresence initial={false}>
                        {exceedsBalance && (
                          <motion.div
                            initial={{ opacity: 0, y: -4, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -4, height: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            role="alert"
                            className="flex items-start gap-2 overflow-hidden text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-1.5"
                          >
                            <AlertCircle size={14} className="mt-px shrink-0" />
                            <span>
                              Input{" "}
                              <span className="font-semibold tabular">
                                {formatMoney(amountNum)}
                              </span>{" "}
                              is greater than the remaining balance of{" "}
                              <span className="font-semibold tabular">
                                {formatMoney(remaining)}
                              </span>
                              . Enter an amount up to{" "}
                              <span className="font-semibold tabular">
                                {formatMoney(remaining)}
                              </span>
                              .
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </AmountField>
                    <Field
                      label="Transaction Method"
                      hint="How the budget will be released."
                    >
                      <Select
                        value={form?.method}
                        onChange={set("method")}
                        placeholder="Select transaction method"
                        disabled={saving}
                      />
                    </Field>
                    <Field
                      label="Description"
                      hint="A short summary shown in the transaction list."
                      count={(form?.description || "").length}
                      max={DESCRIPTION_MAX}
                    >
                      <TextArea
                        value={form?.description}
                        onChange={set("description")}
                        placeholder="What was this for?"
                        maxLength={DESCRIPTION_MAX}
                        rows={2}
                      />
                    </Field>
                    <Field
                      label="Notes"
                      optional
                      count={(form?.note || "").length}
                      max={NOTE_MAX}
                    >
                      <TextArea
                        value={form?.note}
                        onChange={set("note")}
                        placeholder="Add note..."
                        maxLength={NOTE_MAX}
                        rows={2}
                      />
                    </Field>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {err && (
                    <motion.div
                      ref={errRef}
                      data-error
                      role="alert"
                      initial={{ opacity: 0, y: -4, height: 0, marginTop: 0 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        height: "auto",
                        marginTop: 16,
                      }}
                      exit={{
                        opacity: 0,
                        y: -4,
                        height: 0,
                        marginTop: 0,
                        transition: { duration: 0.25, ease: "easeOut" },
                      }}
                      className="flex items-start gap-2 overflow-hidden text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl px-3.5 py-2.5 leading-snug mt-4"
                    >
                      <AlertCircle size={14} className="mt-px shrink-0" />
                      {err}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 mt-6 pt-5 border-t border-[var(--border)]">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {transaction === "addBudget" ? "Add Budget" : "Issue Budget"}
                </Button>
              </div>
            </motion.form>

            {/* Nested modal: reference id table + add-new-reference form */}
            <ReferencesModal
              open={refsOpen}
              references={references}
              onAdd={addReference}
              onDelete={removeReference}
              onClose={() => setRefsOpen(false)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BudgetModal;
