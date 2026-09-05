class ApiError extends Error {
  constructor(statusCode, message, code = "UNKNOWN_ERROR") {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.isApiError = true;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = "Bad Request", code = "BAD_REQUEST") {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "Forbidden", code = "FORBIDDEN") {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Not Found", code = "NOT_FOUND") {
    return new ApiError(404, message, code);
  }

  static conflict(message = "Conflict", code = "CONFLICT") {
    return new ApiError(409, message, code);
  }

  static internal(
    message = "Internal Server Error",
    code = "INTERNAL_SERVER_ERROR",
  ) {
    return new ApiError(500, message, code);
  }
}

export default ApiError;
