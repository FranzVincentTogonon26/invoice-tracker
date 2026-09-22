export const GEMINI_MODEL_KEY = "gemini_model";
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const hasStorage = () => {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
};

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
