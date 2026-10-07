import Budget from "../models/budget.model.js";
import Employee from "../models/employee.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import {
  createbudgetSchema,
  updateBudgetReferenceSchema,
} from "../validations/budget.validation.js";
import { emitTransaction } from "../realtime/index.js";
import {
  saveIssuedBudgetImage,
  deleteIssuedBudgetImage,
} from "../utils/issuedBudgetImage.js";

// Shared UUID shape check for path params (same regex the other handlers use).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Peso formatting for refusal messages (mirrors the client's formatMoney:
// en-US grouping with the PHP currency symbol), so the remaining balance
// reads exactly like it does in the UI.
const formatPeso = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(Number(n) || 0);

// Statuses a cancelled transaction may be restored to by the undo action.
const RESTORE_STATUSES = ["added", "closed"];

// Statuses a cancelled issued transaction may be restored to (its reference
// status is 'open' | 'close' | 'cancel', so the only undo target is 'open').
const RESTORE_ISSUED_STATUSES = ["open"];

// Restriction notice rendered when an employee still holds an open issued
// budget from a DIFFERENT source of funds — only one budget reference may be
// issued per employee at a time, so the existing issuance has to be reimbursed
// (cancelled / closed) first. Shared by the pre-submit guard endpoint and the
// create-time conflict so both surfaces show the exact same wording.
const issuedConflictMessage = (conflict) => {
  const source =
    conflict?.label || conflict?.reference_id || "another reference";

  return (
    `Cannot proceed your request because the employee you select has already issued from another source of funds (${source}). ` +
    `To avoid conflict on the issued budget, only one budget reference is allowed per employee — ` +
    `please reimburse the existing issued budget (${source}) first before issuing a new budget.`
  );
};

// Employee budget page — the signed-in employee's own issuances
// (`issued_budget` through their `budget_issued_reference`) plus the balance
// overview. Scope ALWAYS comes from the token (`req.user.id`), never from the
// query string, so one employee can never read another's budget. The route
// stacks authMiddleware + requireEmployeeAccess (both reject non-active
// accounts); the user row is re-checked here as well so a suspended account
// is cut off even if its status flipped after the token was minted.
export const budgetEmployee = async (req, res, next) => {
  try {
    const user = await User.findUserById(req.user.id);
    if (!user) throw ApiError.notFound("User not found", "USER_NOT_FOUND");
    if (user.status !== "active") {
      throw ApiError.forbidden(
        "Your account is not active. Please contact an administrator.",
        "ACCOUNT_NOT_ACTIVE",
      );
    }

    const { overview, transactions } = await Budget.employeeBudget(
      user.user_id,
      req.query,
    );
    return res.status(200).json({ overview, transactions });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    // `note` was used below but never destructured -- that crashed the
    // issuedBudget branch with `ReferenceError: note is not defined`.
    const {
      type,
      reference_id,
      employeeId,
      description,
      amount,
      method,
      note,
      label,
      reference_notes,
      approved,
      image_url,
    } = validate(createbudgetSchema, req.body);

    // zod guarantees `amount` is a positive number; normalize just in case
    const parsedAmount = Number(amount);

    // Source-of-funds gate: a budget reference connects writes only while
    // its status is 'open'. Closed sources accept no top-ups, no issuances
    // and no restores — pickers already hide them; this is the enforcement.
    if (
      (type === "addBudget" || type === "issuedBudget") &&
      !(await Budget.isReferenceOpen(reference_id))
    ) {
      throw ApiError.conflict(
        "This budget source is closed — only open sources accept activity.",
        "REFERENCE_NOT_OPEN",
      );
    }

    if (type === "issuedBudget") {
      const validateEmployee = await Employee.findEmployeeById(employeeId);
      if (!validateEmployee)
        throw ApiError.badRequest("Employee not found", "EMPLOYEE_NOT_FOUND");

      // Restriction guard — an employee may only hold ONE open issued budget
      // reference at a time. An open issuance tied to a DIFFERENT source of
      // funds blocks the request until that issuance is reimbursed (cancelled
      // or closed). Same-reference top-ups stay allowed.
      const [conflictingReference] = await Budget.employeeOpenIssuedReferences({
        user_id: employeeId,
        reference_id: reference_id || null,
      });

      if (conflictingReference)
        throw ApiError.conflict(
          issuedConflictMessage(conflictingReference),
          "EMPLOYEE_ISSUED_CONFLICT",
        );

      // Dedup-aware issuance: reuses the OPEN `budget_issued_reference` row
      // for this (employeeId, reference_id) pair when one already exists and
      // only inserts a fresh parent row when there is none yet — repeated
      // issues to the same employee from the same source never stack up
      // duplicate parent rows. Both writes run in one transaction.
      const { issuedBudget, reused } = await Budget.issueBudgetToEmployee({
        reference_id: reference_id,
        user_id: employeeId,
        amount: parsedAmount,
        description: String(description).trim(),
        method,
        note: note || null,
        // Scanned receipt attachment (Issue Budget scan flow) — only present
        // when the admin scanned a receipt for this issuance; otherwise NULL.
        image_url: image_url || null,
      });

      emitTransaction({
        action: "create",
        entity: "issued-budget",
        actor: req.user,
        message: `Issued ${formatPeso(parsedAmount)} to ${validateEmployee?.name ?? employeeId} from budget reference.`,
        metadata: { amount: parsedAmount, userId: employeeId, reference_id, issuedId: issuedBudget?.id ?? null, reused: Boolean(reused) },
        notifyUserIds: [employeeId],
      });

      return res.status(201).json({
        message: reused
          ? "Budget issued successfully (added to the employee's existing issuance for this source)."
          : "Issued Budget Successfully",
        issuedBudget,
      });
    }
    if (type === "addBudget") {
      const newBudget = await Budget.createBudget({
        reference_id: reference_id,
        amount: parsedAmount,
        description: String(description).trim(),
        method,
        approved_by: approved,
      });

      emitTransaction({
        action: "create",
        entity: "budget",
        actor: req.user,
        message: `Added ${formatPeso(parsedAmount)} budget funds (${String(description).trim()}).`,
        metadata: { amount: parsedAmount, reference_id, budgetId: newBudget?.id ?? null },
      });

      return res.status(201).json({ budget: newBudget });
    }
    if (type === "addBudgetReference") {
      const newReference = await Budget.createReferenceBudget({
        // reference_id is generated by the DB (gen_random_uuid default)
        label: String(label).trim(),
        notes: reference_notes ?? null,
      });

      emitTransaction({
        action: "create",
        entity: "budget-reference",
        actor: req.user,
        message: `Created budget source of funds "${String(label).trim()}".`,
        metadata: { reference_id: newReference?.reference_id ?? newReference?.id ?? null, label: String(label).trim() },
      });

      return res.status(201).json({ budget: newReference });
    }
  } catch (err) {
    next(err);
  }
};

// POST /budgets/issued-receipt-image — the deferred half of the Issue Budget
// scan flow. The browser holds the picked receipt in memory while the admin
// reviews the form; this endpoint is called ONCE on "Issue Budget" with that
// single file (`file`), so nothing lands in `uploads/receipts_issued_budget`
// before the confirmation and no scan leaves an orphan behind when the form
// is discarded. The returned `image_url` is stored on the
// `issued_budget` row by the create call that follows.
export const uploadIssuedReceiptImage = async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest("No receipt file uploaded");
    const image_url = await saveIssuedBudgetImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
    return res
      .status(201)
      .json({ image_url, file_name: req.file.originalname ?? "" });
  } catch (err) {
    next(err);
  }
};

// GET /budgets/references — Source of Funds management list (AdminSourceFunds
// page): EVERY reference with live aggregates, newest first. Unlike the
// picker lists, disconnected (cut_off) sources stay visible here so they can
// be edited, reopened or deleted.
export const sourceFunds = async (req, res, next) => {
  try {
    const sources = await Budget.sourceFunds(req.query);
    return res.status(200).json({ sources });
  } catch (err) {
    next(err);
  }
};

// PATCH /budgets/references/:referenceId — edit a source of funds (label /
// notes / status). Closing ('open' → 'cut_off') disconnects the source from
// every flow; reopening restores it.
export const updateReference = async (req, res, next) => {
  try {
    const { referenceId } = req.params;
    if (!UUID_RE.test(referenceId || ""))
      throw ApiError.badRequest("Invalid reference id", "VALIDATION_ERROR");

    const payload = validate(updateBudgetReferenceSchema, req.body ?? {});
    const updated = await Budget.updateReference(referenceId, payload);
    if (!updated)
      throw ApiError.notFound("Reference not found", "REFERENCE_NOT_FOUND");

    emitTransaction({
      action: "update",
      entity: "budget-reference",
      actor: req.user,
      message:
        payload.status === "cut_off"
          ? `Closed budget source "${updated?.label ?? referenceId}" — it no longer connects to any flow.`
          : payload.status === "open"
            ? `Reopened budget source "${updated?.label ?? referenceId}".`
            : `Updated budget source "${updated?.label ?? referenceId}".`,
      metadata: { reference_id: referenceId, label: updated?.label ?? null, status: updated?.status ?? null },
    });

    return res.status(200).json({ reference: updated });
  } catch (err) {
    next(err);
  }
};

// Balance summary for one budget reference — powers the live "Balance"
// readout in the issuedBudget form (allocated vs issued vs remaining).
export const referenceBalance = async (req, res, next) => {
  try {
    const { referenceId } = req.params;
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!UUID_RE.test(referenceId || ""))
      throw ApiError.badRequest("Invalid reference id", "VALIDATION_ERROR");

    const summary = await Budget.referenceBalance(referenceId);
    return res.status(200).json({ balance: summary });
  } catch (err) {
    next(err);
  }
};

// Pre-submit restriction guard for the issuedBudget form: given an employee
// (and optionally the source of funds being issued from), reports whether the
// employee still holds an open issuance from another budget reference.
// Responds with `{ openReferences, conflict, message }` — `conflict` is the
// most recent offending row (null when the employee is clear) so the modal can
// block submission and explain how to proceed (reimburse the existing
// issuance first).
export const employeeIssuedGuard = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const { reference_id } = req.query;

    if (!UUID_RE.test(employeeId || ""))
      throw ApiError.badRequest("Invalid employee id", "VALIDATION_ERROR");
    if (reference_id && !UUID_RE.test(reference_id))
      throw ApiError.badRequest("Invalid reference id", "VALIDATION_ERROR");

    const openReferences = await Budget.employeeOpenIssuedReferences({
      user_id: employeeId,
      reference_id: reference_id || null,
    });
    const conflict = openReferences[0] ?? null;

    return res.status(200).json({
      openReferences,
      conflict,
      message: conflict ? issuedConflictMessage(conflict) : null,
    });
  } catch (err) {
    next(err);
  }
};

// Deletes a budget reference row. This is a hard DELETE — the `budget` /
// `budget_issued_reference` rows that reference it are destroyed along with
// it (ON DELETE CASCADE).
export const deleteReference = async (req, res, next) => {
  try {
    const { referenceId } = req.params;
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!UUID_RE.test(referenceId || ""))
      throw ApiError.badRequest("Invalid reference id", "VALIDATION_ERROR");

    const closed = await Budget.deleteReference(referenceId);
    if (!closed)
      throw ApiError.notFound("Reference not found", "REFERENCE_NOT_FOUND");

    emitTransaction({
      action: "delete",
      entity: "budget-reference",
      actor: req.user,
      message: `Deleted budget source of funds (${closed?.label ?? referenceId}) with cascading rows.`,
      metadata: { referenceId, label: closed?.label ?? null },
    });

    return res.status(200).json({ budget: closed });
  } catch (err) {
    next(err);
  }
};

export const budgetInfo = async (req, res, next) => {
  try {
    const [budgetOverview, employeeBudgets, employees, budgetReference] =
      await Promise.all([
        Budget.budgetOverview(),
        Budget.employeesWithBudget(),
        Employee.employeeList(),
        Budget.budgetReference(),
      ]);

    return res.status(200).json({
      budgetOverview,
      employeeBudgets,
      employees,
      budgetReference,
    });
  } catch (err) {
    next(err);
  }
};

export const budgetTransaction = async (req, res, next) => {
  try {
    // Forward `status` / `search` query params so the list can be filtered.
    const budgetTransaction = await Budget.budgetTransaction(req.query);
    res.json({ budgetTransaction });
  } catch (err) {
    next(err);
  }
};

export const budgetIssuedTransaction = async (req, res, next) => {
  try {
    const budgetIssuedTransaction = await Budget.budgetIssuedTransaction(
      req.query,
    );
    res.json({ budgetIssuedTransaction });
  } catch (err) {
    next(err);
  }
};

// Cancels a budget transaction (budget.status -> 'cancelled'). Responds with
// the previous status so the UI can offer an undo window.
export const cancelBudget = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid budget id", "VALIDATION_ERROR");

    const result = await Budget.cancelBudget(id);
    if (!result)
      throw ApiError.notFound("Budget not found", "BUDGET_NOT_FOUND");
    if (result.insufficientBalance)
      throw ApiError.badRequest(
        `Cannot proceed your request — the transaction amount ${formatPeso(result.amount)} is greater than the remaining budget ${formatPeso(result.remaining)} for "${result.sourceLabel || "this source"}".`,
        "INSUFFICIENT_BALANCE",
      );

    emitTransaction({
      action: "status",
      entity: "budget",
      actor: req.user,
      message: `Cancelled budget transaction (${formatPeso(result.budget?.amount ?? result.amount)}).`,
      metadata: { id, amount: result.budget?.amount ?? result.amount ?? null, previousStatus: result.previousStatus },
    });

    return res.status(200).json({
      previousStatus: result.previousStatus,
      budget: result.budget,
    });
  } catch (err) {
    next(err);
  }
};

// Permanently deletes a cancelled budget transaction (hard delete of the
// row). Admin-only at the route layer (`requireAdminAccess` re-checks the
// token role, so a forged client or non-admin token is rejected before this
// runs). Live rows are refused with 409 — cancel first, then delete.
export const removeTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid budget id", "VALIDATION_ERROR");

    const result = await Budget.removeTransaction(id);
    if (!result || result.notFound)
      throw ApiError.notFound("Budget not found", "BUDGET_NOT_FOUND");
    if (result.notCancelled)
      throw ApiError.conflict(
        "Only a cancelled transaction can be permanently deleted. Cancel it first.",
        "BUDGET_NOT_CANCELLED",
      );

    emitTransaction({
      action: "delete",
      entity: "budget",
      actor: req.user,
      message: `Permanently deleted cancelled budget transaction (${result.deleted?.id ?? id}).`,
      metadata: { id, amount: result.deleted?.amount ?? null },
    });

    return res.status(200).json({ budget: result.deleted });
  } catch (err) {
    next(err);
  }
};

// Undo a cancellation — restores the transaction's previous status and clears
// the cancelled_at stamp.
export const restoreBudget = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid budget id", "VALIDATION_ERROR");
    if (!RESTORE_STATUSES.includes(status))
      throw ApiError.badRequest("Invalid restore status", "VALIDATION_ERROR");

    const restored = await Budget.restoreBudget(id, status);
    if (!restored)
      throw ApiError.notFound("Budget not found", "BUDGET_NOT_FOUND");
    if (restored.notOpen)
      throw ApiError.conflict(
        "This budget source is closed — only open sources accept activity.",
        "REFERENCE_NOT_OPEN",
      );

    emitTransaction({
      action: "update",
      entity: "budget",
      actor: req.user,
      message: `Restored budget transaction to '${status}' (${restored?.id ?? id}).`,
      metadata: { id, status, amount: restored?.amount ?? null },
    });

    return res.status(200).json({ budget: restored });
  } catch (err) {
    next(err);
  }
};

// Cancels an issued budget transaction — flips the parent
// `budget_issued_reference.status` to 'cancel'. Responds with the previous
// status so the UI can offer restore feedback.
export const cancelIssuedTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest(
        "Invalid issued transaction id",
        "VALIDATION_ERROR",
      );

    const result = await Budget.cancelIssuedTransaction(id);
    if (!result)
      throw ApiError.notFound(
        "Issued transaction not found",
        "ISSUED_TRANSACTION_NOT_FOUND",
      );
    if (result.insufficientBalance)
      throw ApiError.badRequest(
        `Cannot proceed your request — ${result.employeeName || "The employee"} has only ${formatPeso(result.remaining)} remaining balance after their open abono.`,
        "INSUFFICIENT_BALANCE",
      );

    emitTransaction({
      action: "status",
      entity: "issued-budget",
      actor: req.user,
      message: `Cancelled issued budget for ${result.employeeName ?? "employee"} (${result.issuedReference?.id ?? id}).`,
      metadata: { id, employeeName: result.employeeName ?? null, userId: result.issuedReference?.user_id ?? null, previousStatus: result.previousStatus },
      notifyUserIds: result.issuedReference?.user_id ? [result.issuedReference.user_id] : [],
    });

    return res.status(200).json({
      previousStatus: result.previousStatus,
      issuedReference: result.issuedReference,
    });
  } catch (err) {
    next(err);
  }
};

// Permanently deletes a cancelled issued budget transaction — hard-deletes
// the `issued_budget` row (its parent reference is pruned when left
// childless). Admin-only at the route layer (`requireAdminAccess` re-checks
// the token role, so a forged client or non-admin token is rejected before
// this runs). Live rows and rows with linked expenses are refused with 409
// instead of destroying the audit trail.
export const removeIssuedTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest(
        "Invalid issued transaction id",
        "VALIDATION_ERROR",
      );

    const result = await Budget.removeIssuedTransaction(id);
    if (!result || result.notFound)
      throw ApiError.notFound(
        "Issued transaction not found",
        "ISSUED_TRANSACTION_NOT_FOUND",
      );
    if (result.notCancelled)
      throw ApiError.conflict(
        "Only a cancelled issuance can be permanently deleted. Cancel it first.",
        "ISSUED_NOT_CANCELLED",
      );
    if (result.hasExpenses)
      throw ApiError.conflict(
        "Cannot delete this record — it has linked expense records.",
        "ISSUED_HAS_EXPENSES",
      );

    // Ownership lives on the parent `budget_issued_reference` (the child
    // `issued_budget` row has no `user_id`), so the model surfaces it as
    // `result.userId`. Targeting the owner's personal room is what makes the
    // employee ledger drop the row over the socket with no manual refresh —
    // the global `transactions` room is admin-only and never reaches them.
    const ownerId = result.userId ?? result.deleted?.user_id ?? null;

    // Also drop the scanned receipt file from
    // `uploads/receipts_issued_budget` when this row carried one — but only
    // once nothing else points at it, so a shared image survives until its
    // last referencing row is deleted too. Tied to THIS deleted row's
    // `image_url`, so only its own file can ever be removed.
    if (result.deleted?.image_url) {
      const stillReferenced = await Budget.countIssuedByImageUrl(
        result.deleted.image_url,
      );
      if (stillReferenced === 0)
        await deleteIssuedBudgetImage(result.deleted.image_url);
    }

    emitTransaction({
      action: "delete",
      entity: "issued-budget",
      actor: req.user,
      message: `Permanently deleted cancelled issuance (${result.deleted?.id ?? id}).`,
      metadata: { id, userId: ownerId, amount: result.deleted?.amount ?? null, reference_id: result.reference_id ?? null, issuedId: result.deleted?.id ?? id },
      notifyUserIds: ownerId ? [ownerId] : [],
    });

    return res.status(200).json({ issuedTransaction: result.deleted });
  } catch (err) {
    next(err);
  }
};

// Undo an issued cancellation — restores the reference to its previous status
// ('open').
export const restoreIssuedTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest(
        "Invalid issued transaction id",
        "VALIDATION_ERROR",
      );
    if (!RESTORE_ISSUED_STATUSES.includes(status))
      throw ApiError.badRequest("Invalid restore status", "VALIDATION_ERROR");

    const restored = await Budget.restoreIssuedTransaction(id, status);
    if (!restored)
      throw ApiError.notFound(
        "Issued transaction not found",
        "ISSUED_TRANSACTION_NOT_FOUND",
      );
    if (restored.notOpen)
      throw ApiError.conflict(
        "This budget source is closed — only open sources accept activity.",
        "REFERENCE_NOT_OPEN",
      );

    emitTransaction({
      action: "update",
      entity: "issued-budget",
      actor: req.user,
      message: `Restored issued budget to '${status}' (${restored?.id ?? id}).`,
      metadata: { id, status, userId: restored?.user_id ?? null },
      notifyUserIds: restored?.user_id ? [restored.user_id] : [],
    });

    return res.status(200).json({ issuedReference: restored });
  } catch (err) {
    next(err);
  }
};
