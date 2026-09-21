import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { ENV } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const MODEL = ENV.GIMINI_MODEL || DEFAULT_MODEL;
const MODEL_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const resolveModel = (requested) => {
  const candidate = typeof requested === "string" ? requested.trim() : "";
  return MODEL_RE.test(candidate) ? candidate : MODEL;
};
let client = null;
const getClient = () => {
  const key = ENV.GIMINI_API_KEY;
  if (!key)
    throw new ApiError(503, "Gemini API key is not configured on the server.");
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
};

const generate = async ({ input, schema, model }) => {
  try {
    const result = await getClient().interactions.create({
      model: resolveModel(model),
      input,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema,
      },
    });
    const output_text =
      result?.output_text ??
      (typeof result?.text === "function"
        ? result.text()
        : typeof result?.text === "string"
          ? result.text
          : undefined);
    if (!output_text)
      throw new ApiError(502, "Gemini returned an empty response.");
    return output_text;
  } catch (err) {
    console.error("Gemini request failed:", err?.message ?? err);
    if (err.isApiError) throw err;
    const status = err.status || err.statusCode;
    switch (status) {
      case 400:
        throw new ApiError(502, "Invalid Gemini request.");
      case 401:
        throw new ApiError(503, "Invalid Gemini API key.");
      case 403:
        throw new ApiError(503, "Gemini API access denied.");
      case 429:
        throw new ApiError(429, "Gemini quota exceeded.");
    }
    throw new ApiError(
      502,
      "The AI service is temporarily unavailable. Please select another Source.",
    );
  }
};

const receiptResponseSchema = {
  type: Type.OBJECT,
  required: ["lineItems"],
  properties: {
    vendor: { type: Type.STRING },
    receipt_date: { type: Type.STRING, description: "YYYY-MM-DD if visible" },
    currency: { type: Type.STRING },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ["description", "quantity", "rate"],
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          rate: { type: Type.NUMBER, description: "Unit price" },
        },
      },
    },
    subtotal: { type: Type.NUMBER },
    total: { type: Type.NUMBER, description: "Grand total" },
    suggested_category: { type: Type.STRING },
  },
};

const receiptLineItemSchema = z.object({
  description: z.coerce.string().catch(""),
  quantity: z.coerce.number().positive().catch(1),
  rate: z.coerce.number().nonnegative().catch(0),
});

const receiptValidator = z.object({
  vendor: z.coerce.string().catch(""),
  receipt_date: z.coerce.string().catch(""),
  currency: z.coerce.string().catch(""),
  lineItems: z.array(receiptLineItemSchema).catch([]),
  subtotal: z.coerce.number().nonnegative().catch(0),
  total: z.coerce.number().nonnegative().catch(0),
  suggested_category: z.coerce.string().catch(""),
});

const parseJson = (text) => {
  const cleaned = String(text)
    .replace(/^```(?:json)?\s*|\s*```$/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ApiError(502, "Couldn't read the AI response.");
  }
};

export const generateReceipt = async ({ buffer, mimeType, model }) => {
  const prompt = [
    "You are an accounts-payable assistant. Extract structured data from this receipt image/PDF.",
    "Return the vendor, receipt date (YYYY-MM-DD), currency, each line item (description, quantity, unit rate), subtotal, and grand total.",
    "If a value is not visible, use an empty string or 0. Quantities default to 1 when not shown.",
    "Suggest a sensible expense category in suggested_category.",
  ].join("\n");

  const media =
    mimeType === "application/pdf"
      ? {
          type: "document",
          data: buffer.toString("base64"),
          mime_type: mimeType,
        }
      : { type: "image", data: buffer.toString("base64"), mime_type: mimeType };

  const text = await generate({
    input: [{ type: "text", text: prompt }, media],
    schema: receiptResponseSchema,
    model,
  });

  return receiptValidator.parse(parseJson(text));
};

const suggestionResponseSchema = {
  type: Type.OBJECT,
  required: ["description", "category"],
  properties: {
    description: {
      type: Type.STRING,
      description:
        "Short, human-friendly expense description summarizing the whole receipt",
    },
    category: {
      type: Type.STRING,
      description:
        "Category name copied exactly from the provided list, or an empty string when nothing fits",
    },
  },
};

const suggestionValidator = z.object({
  description: z.coerce.string().catch(""),
  category: z.coerce.string().catch(""),
});

export const generateExpenseSuggestions = async ({
  vendor,
  date,
  items,
  categories,
  model,
}) => {
  const lines = items
    .map((item, index) =>
      [
        `#${index + 1}`,
        `description: ${item.description || "(blank)"}`,
        `qty: ${item.quantity ?? 1}`,
        `rate: ${item.rate ?? 0}`,
        `amount: ${item.amount ?? 0}`,
      ].join(" | "),
    )
    .join("\n");

  const prompt = [
    "You are an accounts-payable assistant for a Philippine small business.",
    "The admin logs this whole scanned receipt as ONE expense line, so analyze the receipt below and answer with a single suggestion:",
    '1. description — ONE short, human-friendly expense description in Title Case, at most 6 words, summarizing what was bought (e.g. "Groceries and office supplies"). Prefer the wording an admin would type themselves over POS shorthand; fall back to the vendor name when the lines are unreadable.',
    "2. category — exactly one name copied from the category list, or an empty string when none of them fit the purchase.",
    "Rules: never answer per line, never add extra entries, and never invent a category that isn't in the list.",
    "",
    `Vendor: ${vendor || "(not readable)"}`,
    `Receipt date: ${date || "(not readable)"}`,
    `Category list: ${categories.length ? categories.join(", ") : "(none available)"}`,
    "Scanned lines:",
    lines,
  ].join("\n");

  const text = await generate({
    input: [{ type: "text", text: prompt }],
    schema: suggestionResponseSchema,
    model,
  });

  return suggestionValidator.parse(parseJson(text));
};
