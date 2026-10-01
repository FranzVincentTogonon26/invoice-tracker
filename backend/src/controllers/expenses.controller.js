import Expenses from "../models/expenses.model.js";
import Budget from "../models/budget.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import {
  createExpensesSchema,
  updateExpenseStatusSchema,
  updateExpenseDescriptionSchema,
} from "../validations/expenses.validation.js";
import { deleteReceiptImage, saveReceiptImage } from "../utils/receiptImage.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Row-level access for the single-expense endpoints (detail / delete):
// admins may touch any row; everyone else must be an *active employee* and
// the owner of that row. A rejected caller gets the plain "not found" instead
// of a 403 so the response never reveals that someone else's expense id
// exists (and so an admin/employee token can't be swapped to read sideways).
const canTouchRow = (req, expense) => {
  if (req.user?.role === "admin") return true;
  return (
    req.user?.role === "employee" &&
    req.user?.status === "active" &&
    String(expense?.user_id ?? "") === String(req.user?.id ?? "")
  );
};

export const expenses = async (req, res, next) => {
  try {
    // authMiddleware already proved the caller is a real users row (the JWT's
    // user_id exists) with status = 'active' — every branch below trusts
    // `req.user` because of it. Employees only ever see their own ledger, and
    // their source of funds is their own remaining balance (built in the
    // model); admins keep the full budget-reference list (existing logic).
    if (req.user.role === "employee") {
      const { categories, expenses: rows, overview, references } =
        await Expenses.expensesOverviewEmployee(req.query, req.user.id);
      const gemini_model = await Expenses.geminiModel();
      return res
        .status(200)
        .json({ expenses: rows, categories, overview, gemini_model, references });
    }

    const {
      categories,
      expenses: rows,
      overview,
      gemini_model,
      references,
    } = await Expenses.expensesOverview(req.query);
    return res
      .status(200)
      .json({ expenses: rows, categories, overview, gemini_model, references });
  } catch (err) {
    next(err);
  }
};

export const expensesEmployee = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const { categories, expenses: rows, overview, references } =
      await Expenses.expensesOverviewEmployee({ from, to }, req.user.id);
    return res.status(200).json({ expenses: rows, categories, overview, references });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const payload = validate(createExpensesSchema, req.body);
    if (payload.type === "category") {
      const existing = await Expenses.findCategoryByName(payload.category_name);
      if (existing) {
        throw ApiError.conflict(
          `Category "${existing.category_name}" already exists.`,
          "CATEGORY_ALREADY_EXISTS",
        );
      }
      const category = await Expenses.createCategory({
        category_name: payload.category_name,
      });
      return res
        .status(201)
        .json({
          category,
          message: `Category "${category.category_name}" added.`,
        });
    }
    if (payload.type === "receipt") {
      const qty = payload.qty ?? 1;
      const rate = payload.rate ?? 0;
      const amount = payload.amount ?? Number((qty * rate).toFixed(2));
      const receipt = await Expenses.createReceipt({
        receipt_id: payload.receipt_id ?? null,
        vendor: payload.vendor ?? null,
        description: payload.description,
        qty,
        rate,
        amount,
        items: payload.items ?? [],
      });
      return res
        .status(201)
        .json({ receipt, message: "Receipt scanned successfully." });
    }
    // Tag the save with the picked source for both roles: admins tag the
    // budget reference they spent from, employees tag the reference their
    // remaining balance was issued from. An employee may only tag a reference
    // they hold an open issuance for — anything else is dropped to NULL.
    let referenceId = payload.reference_id ?? null;
    if (req.user.role === "employee" && referenceId) {
      const held = await Budget.employeeOpenIssuedReferences({
        user_id: req.user.id,
      });
      if (!held.some((row) => row.reference_id === referenceId)) {
        referenceId = null;
      }
    }

    // Employee-only backdated guard: a line dated before the FIRST budget
    // issuance linked to this token's user_id (`budget_issued_reference`
    // .created_at, any status) is stored with `expenses.flag = 1` — the
    // "Flagged" mark the admin ledger shows. The role comes from the verified
    // token, so an admin save (or an employee who holds no issuance yet) passes
    // null and nothing is ever flagged.
    const firstIssuedAt =
      req.user.role === "employee"
        ? await Expenses.firstIssuedAt(req.user.id)
        : null;

    const rows = await Expenses.createExpenses({
      items: payload.items,
      user_id: req.user.id,
      issued_ref_id: payload.issued_ref_id ?? null,
      // authMiddleware guarantees req.user is an active users row. Employee
      // spend is already subtracted from the reference via `issued`, so the
      // admin-side sums exclude employee rows (see budget.model.js /
      // expenses.model.js) to keep it from being charged twice.
      reference_id: referenceId,
      receipts: payload.receipts ?? [],
      image_url: payload.image_url ?? null,
      receipt_date: payload.receipt_date ?? null,
      first_issued_at: firstIssuedAt,
    });
    return res.status(201).json({
      expenses: rows,
      message: `${rows.length} expense line${rows.length === 1 ? "" : "s"} saved.`,
    });
  } catch (err) {
    next(err);
  }
};

// POST /expenses/receipt-images — the deferred half of the scan flow. The
// browser parks every picked receipt in memory while the admin reviews the
// form; this endpoint is called ONCE on "Save expenses" with every held file
// (`files[]`), so nothing is written to `uploads/receipts` before that
// confirmation and no scan can leave an orphan behind when the form is
// discarded. Each file is stored through `saveReceiptImage` and the response
// mirrors the multipart order (`images[i]` belongs to `files[i]`), which lets
// the client zip every URL back onto its own expense line. If any write
// fails, the files already stored in this batch are removed again so a failed
// save never leaves a partial set behind.
export const uploadReceiptImages = async (req, res, next) => {
  const stored = [];
  try {
    const images = [];

    for (const file of req.files) {
      const image_url = await saveReceiptImage({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
      stored.push(image_url);
      images.push({ file_name: file.originalname ?? "", image_url });
    }

    return res.status(201).json({ images });
  } catch (err) {
    await Promise.all(stored.map((url) => deleteReceiptImage(url)));
    next(err);
  }
};

export const removeCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid category id", "VALIDATION_ERROR");
    const category = await Expenses.removeCategory(id);
    if (!category)
      throw ApiError.notFound("Category not found", "CATEGORY_NOT_FOUND");
    return res
      .status(200)
      .json({ category, message: "Category removed successfully." });
  } catch (err) {
    next(err);
  }
};

export const detail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const expense = await Expenses.findExpenseById(id);
    if (!expense || !canTouchRow(req, expense))
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    // The scanned lines of the receipt this expense was saved from (empty when
    // the row has no receipt). Pulled through the shared draft id so the modal
    // can show every line, not just the one the expense points at.
    const receiptItems = await Expenses.receiptLinesForExpense(
      expense.receipt_id,
    );
    const vendor =
      receiptItems.find((item) => String(item?.vendor ?? "").trim())
        ?.vendor?.trim() ?? "";

    return res.status(200).json({ expense, receiptItems, vendor });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    // Ownership first: an employee may only delete their own row (admins keep
    // the full ledger), and a stranger sees "not found" — never a 403 that
    // would confirm the id exists.
    const existing = await Expenses.findExpenseById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    const expense = await Expenses.removeExpense(id);
    if (!expense)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    // Also drop the stored receipt file from uploads/receipts — but only once
    // nothing else points at it: every line of one confirmed scan carries the
    // same `image_url`, so siblings keep their image until they're deleted too.
    if (expense.image_url) {
      const stillReferenced = await Expenses.countByImageUrl(
        expense.image_url,
      );
      if (stillReferenced === 0) await deleteReceiptImage(expense.image_url);
    }

    return res
      .status(200)
      .json({ expense, message: "Expense removed successfully." });
  } catch (err) {
    next(err);
  }
};

// Soft delete / status move: the row is kept and only its status changes. The
// employee ledger uses this for its "Delete expense" action — parking the
// record in 'draft' instead of removing it — so the stored receipt file is
// deliberately left alone here: the row (and its image) remain in the ledger.
export const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const payload = validate(updateExpenseStatusSchema, req.body);

    // Same ownership rule as detail / remove: an employee may only touch their
    // own row (admins keep the full ledger), and a stranger sees "not found" —
    // never a 403 that would confirm the id exists.
    const existing = await Expenses.findExpenseById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    const expense = await Expenses.updateExpenseStatus(id, payload.status);
    if (!expense)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    return res.status(200).json({
      expense,
      message: `Expense status updated to ${payload.status}.`,
    });
  } catch (err) {
    next(err);
  }
};

// Admin ledger row action ("Add to draft" in the admin RowActions menu): the
// mirror of the employee's soft delete — an employee-authored expense that is
// still 'paid' (or voided 'cancel') is parked back in 'draft'. The model
// guards the employee + paid-or-cancelled condition inside the UPDATE, so this
// handler only explains why nothing was updated: a missing id is a 404, and an
// id that belongs to an admin row or is no longer paid/cancelled answers with
// a 409 describing the rule.
export const markEmployeeDraft = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const expense = await Expenses.markEmployeeExpenseDraft(id);
    if (expense) {
      return res.status(200).json({
        expense,
        message: "Expense moved back to draft.",
      });
    }

    const existing = await Expenses.findExpenseById(id);
    if (!existing)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");
    if (existing.created_by_role !== "employee")
      throw ApiError.conflict(
        "Only an expense recorded by an employee can be moved back to draft.",
        "EXPENSE_NOT_EMPLOYEE_ROW",
      );

    throw ApiError.conflict(
      `Only a paid or cancelled expense can be moved back to draft (current status: ${existing.status}).`,
      "EXPENSE_NOT_PAID",
    );
  } catch (err) {
    next(err);
  }
};

// Admin ledger row action ("Remove from draft" in the admin RowActions menu):
// the counterpart of markEmployeeDraft — an employee-authored draft is put
// back to 'paid', so it counts against that employee's balance again. The model
// guards the employee + draft condition inside the UPDATE, so this handler only
// explains why nothing was updated: a missing id is a 404, and an id that
// belongs to an admin row or is no longer a draft answers with a 409.
export const markEmployeePaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const expense = await Expenses.markEmployeeExpensePaid(id);
    if (expense) {
      return res.status(200).json({
        expense,
        message: "Expense moved back to paid.",
      });
    }

    const existing = await Expenses.findExpenseById(id);
    if (!existing)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");
    if (existing.created_by_role !== "employee")
      throw ApiError.conflict(
        "Only an expense recorded by an employee can be moved back to paid.",
        "EXPENSE_NOT_EMPLOYEE_ROW",
      );

    throw ApiError.conflict(
      `Only a draft expense can be moved back to paid (current status: ${existing.status}).`,
      "EXPENSE_NOT_DRAFT",
    );
  } catch (err) {
    next(err);
  }
};

// Admin approval for a flagged expense ("Approve flag" inside the
// flaggedNotice of the View expense modal): clears `expenses.flag` back to 0.
// Idempotent — an already-cleared row still answers 200 so a double click or a
// stale table never surfaces as an error.
export const clearFlag = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const existing = await Expenses.findExpenseById(id);
    if (!existing)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    if (Number(existing.flag) !== 1) {
      return res.status(200).json({
        expense: { id: existing.id, flag: 0 },
        message: "Flag already cleared.",
      });
    }

    const expense = await Expenses.clearExpenseFlag(id);
    return res.status(200).json({
      expense,
      message: "Flag approved and cleared.",
    });
  } catch (err) {
    next(err);
  }
};

// Update expense description (inline editing from transaction sheet)
export const updateDescription = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");

    const payload = validate(updateExpenseDescriptionSchema, req.body);

    // Same ownership rule as detail / remove: an employee may only touch their
    // own row (admins keep the full ledger), and a stranger sees "not found" —
    // never a 403 that would confirm the id exists.
    const existing = await Expenses.findExpenseById(id);
    if (!existing || !canTouchRow(req, existing))
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    const expense = await Expenses.updateExpenseDescription(id, payload.description);
    if (!expense)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");

    return res.status(200).json({
      expense,
      message: "Description updated.",
    });
  } catch (err) {
    next(err);
  }
};
