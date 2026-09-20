import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

import { ENV } from "../config/env.js";
import ApiError from "../utils/ApiError.js";

// Fall back to a sane default so a missing GIMINI_MODEL doesn't produce
// "model is required" errors from the API with no hint as to why.
const MODEL = ENV.GIMINI_MODEL || "gemini-3.5-flash"; // gemini-2.5-flash-lite

let client = null;

const getClient = () => {
  const key = ENV.GIMINI_API_KEY;
  if (!key)
    throw new ApiError(503, "Gemini API key is not configured on the server.");

  if (!client) {
    client = new GoogleGenAI({ apiKey: key });
  }
  return client;
};

// Thin wrapper around the SDK's `interactions` API. The v2 SDK expects
// snake_case params (`input`, `response_format`) whose content blocks are
// `{ type: "text" | "image" | "document", ... }` — NOT the old
// `{ role, parts }` shape — and it exposes the reply as `output_text`.
const generate = async ({ input, schema }) => {
  try {
    const result = await getClient().interactions.create({
      model: MODEL,
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

    if (!output_text) {
      throw new ApiError(502, "Gemini returned an empty response.");
    }
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
      "The AI service is temporarily unavailable. Please try again.",
    );
  }
};

// Structured extraction contract sent to Gemini (OpenAPI-style schema, same
// shape `Type.*` builds). Everything but the line items is optional so a
// messy receipt still yields its items instead of failing wholesale.
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

// Server-side guard on whatever Gemini returns: coerces numbers, tolerates
// missing/extra fields, and never throws on a partially-good response
// (`.catch()` fills defaults) so one odd field can't fail the whole scan.
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

// Gemini can wrap JSON in markdown fences even with response_format set.
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

export const generateReceipt = async ({ buffer, mimeType }) => {
  const prompt = [
    "You are an accounts-payable assistant. Extract structured data from this receipt image/PDF.",
    "Return the vendor, receipt date (YYYY-MM-DD), currency, each line item (description, quantity, unit rate), subtotal, and grand total.",
    "If a value is not visible, use an empty string or 0. Quantities default to 1 when not shown.",
    "Suggest a sensible expense category in suggested_category.",
  ].join("\n");

  // Media block type follows the file: PDFs travel as "document" content,
  // everything else (PNG/JPG/WEBP/HEIC) as "image".
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
  });

  return receiptValidator.parse(parseJson(text));
};
