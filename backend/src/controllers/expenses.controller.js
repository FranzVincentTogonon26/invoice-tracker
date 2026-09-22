import Expenses from "../models/expenses.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { createExpensesSchema } from "../validations/expenses.validation.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const expenses = async (req, res, next) => {
  try {
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
    const rows = await Expenses.createExpenses({
      items: payload.items,
      user_id: req.user.id,
      issued_ref_id: payload.issued_ref_id ?? null,
      reference_id: payload.reference_id ?? null,
      receipts: payload.receipts ?? [],
      image_url: payload.image_url ?? null,
      receipt_date: payload.receipt_date ?? null,
    });
    return res.status(201).json({
      expenses: rows,
      message: `${rows.length} expense line${rows.length === 1 ? "" : "s"} saved.`,
    });
  } catch (err) {
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

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id || ""))
      throw ApiError.badRequest("Invalid expense id", "VALIDATION_ERROR");
    const expense = await Expenses.removeExpense(id);
    if (!expense)
      throw ApiError.notFound("Expense not found", "EXPENSE_NOT_FOUND");
    return res
      .status(200)
      .json({ expense, message: "Expense removed successfully." });
  } catch (err) {
    next(err);
  }
};
