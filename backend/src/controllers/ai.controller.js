import Employee from "../models/employee.model.js";
import ApiError from "../utils/ApiError.js";
import { validate } from "../utils/validate.js";
import { expenseSuggestSchema } from "../validations/ai.validation.js";
import * as Service from "../services/geminiService.js";
import { deleteReceiptImage, saveReceiptImage } from "../utils/receiptImage.js";

// The model the admin picked in the scan panel's "Source" dropdown — the
// browser keeps it in localStorage ("gemini_model") and sends it on every AI
// request. `geminiService` sanitizes it and falls back to its
// env/built-in default when the header is missing or malformed.
const requestedModel = (req) => req.get("x-gemini-model");

export const extractReceipt = async (req, res, next) => {
  let imageUrl = "";
  try {
    // Store the upload before asking Gemini: the file is what
    // `expenses.image_url` will point at, so a storage failure has to fail the
    // scan (there would be nothing to fall back to).
    imageUrl = await saveReceiptImage({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });

    const data = await Service.generateReceipt({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      model: requestedModel(req),
    });

    return res.status(200).json({
      data: {
        ...data,
        // Public URL of the stored scan — the draft carries this short string
        // through localStorage and the Add Expenses save writes it onto
        // `expenses.image_url`, so photo size never touches the quota again.
        image_url: imageUrl,
        // Fallback label for the draft. The browser knows the picked file's
        // real name and prefers its own copy when it has one.
        file_name: req.file.originalname ?? "",
      },
    });
  } catch (err) {
    // Don't leave the just-stored file behind when the parse failed.
    if (imageUrl) await deleteReceiptImage(imageUrl);
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
      model: requestedModel(req),
    });

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
};
