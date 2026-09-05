import ApiError from "./ApiError.js";

// Validates `data` against a zod schema and throws a 400 ApiError on failure.
// Returns the parsed (and coerced) data on success.
export const validate = (schema, data) => {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw ApiError.badRequest(
      firstIssue?.message || "Invalid request payload.",
      "VALIDATION_ERROR",
    );
  }

  return result.data;
};