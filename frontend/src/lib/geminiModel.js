// Selected Gemini model store.
//
// The "Source" dropdown in the Scan Receipt panel (`ModelSource`) lists the
// models seeded in the `geminimodel` table, served by GET /expenses as
// `gemini_model`. The admin's pick is parked in localStorage under
// "gemini_model" so it survives reloads, and every AI request carries it to
// the backend as the `X-Gemini-Model` header — `geminiService.js` sanitizes it
// and falls back to "gemini-3.1-flash-lite" when nothing valid arrives.
//
// Reading the key seeds the default when it is missing, so the value is always
// a usable model name even before the admin opens the dropdown.

export const GEMINI_MODEL_KEY = "gemini_model";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const hasStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    // Safari (private mode) throws on localStorage access.
    return false;
  }
};

/**
 * The model in effect: the stored pick, or the default — which is written back
 * to localStorage the first time it is read, so "gemini_model" always exists.
 */
export const getGeminiModel = () => {
  if (!hasStorage()) return DEFAULT_GEMINI_MODEL;

  try {
    const stored = window.localStorage.getItem(GEMINI_MODEL_KEY)?.trim();
    if (stored) return stored;

    window.localStorage.setItem(GEMINI_MODEL_KEY, DEFAULT_GEMINI_MODEL);
    return DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
};

/** Persists the dropdown pick; returns the model that is now in effect. */
export const setGeminiModel = (model) => {
  const next = typeof model === "string" ? model.trim() : "";
  if (!next || !hasStorage()) return getGeminiModel();

  try {
    window.localStorage.setItem(GEMINI_MODEL_KEY, next);
    return next;
  } catch {
    return getGeminiModel();
  }
};
