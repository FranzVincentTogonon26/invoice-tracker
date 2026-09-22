import ApiError from "../utils/ApiError.js";

export const errorHandler = (err, req, res, next) => {
  // Malformed request body (body-parser) should be a 400, not a 500
  if (err.type === "entity.parse.failed") {
    err = ApiError.badRequest("Malformed JSON payload.", "INVALID_JSON");
  }

  // PostgreSQL data-format / constraint errors mean the client sent a value
  // the database cannot store (e.g. "3.62" for an INTEGER column) — that is a
  // 400, not a 500.
  if (["22P02", "23514", "22003", "22001"].includes(err.code)) {
    err = ApiError.badRequest(
      "One or more values have an invalid format.",
      "INVALID_VALUE",
    );
  }

  // Convert PostgreSQL unique constraint error to an ApiError
  if (err.code === "23505") {
    err = ApiError.conflict(
      "Resource already exists.",
      "RESOURCE_ALREADY_EXISTS",
    );
  }

  // Convert non-ApiError exceptions into a generic 500 error.
  // Log the ORIGINAL error first — otherwise the root cause is masked.
  if (!(err instanceof ApiError)) {
    console.error("Unhandled error:", err);
    err = ApiError.internal();
  }

  // Log only server errors
  if (err.statusCode >= 500) {
    console.error("Server Error:", err);
  }

  res.status(err.statusCode).json({
    success: false,
    status: err.statusCode,
    code: err.code,
    message: err.message,
  });
};

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound("Resource not found."));
};
