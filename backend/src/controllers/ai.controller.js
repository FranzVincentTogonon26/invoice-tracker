import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { expenseSuggestSchema } from "../validations/ai.validation.js";
import * as Service from "../services/geminiService.js";

export const extractReceipt = async (req, res, next) => {
  try {
    const data = await Service.generateReceipt({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
    });

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
};

// POST /ai/expense-suggest — analyze a confirmed scan (vendor + date + scan
// list items) against the admin's own categories, so the Add Expenses form can
// pre-fill ONE readable description and the best-fit category for the grouped
// receipt line. Text-only: the image is never re-uploaded, the draft already
// carries the extracted lines.
export const suggestExpenses = async (req, res, next) => {
  try {
    const payload = validate(expenseSuggestSchema, req.body);

    const data = await Service.generateExpenseSuggestions({
      vendor: payload.vendor ?? "",
      date: payload.date ?? "",
      items: payload.items,
      categories: payload.categories ?? [],
    });

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
};
