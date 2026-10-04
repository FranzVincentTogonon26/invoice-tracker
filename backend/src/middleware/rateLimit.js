import ApiError from "../utils/ApiError.js";

// Minimal in-memory fixed-window rate limiter (no new dependencies).
// This is a single-instance guard: it blunts brute-force, OTP guessing,
// email floods and AI-quota burn from one box. It is NOT a distributed
// limiter — behind multiple instances / a farm, put the real limit at the
// proxy. Buckets are swept periodically so idle keys never accumulate.
const buckets = new Map();

const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}, 60_000);
// Never keep the process alive just for the sweeper.
if (typeof sweepTimer.unref === "function") sweepTimer.unref();

/**
 * @param {object} opts
 * @param {number} opts.windowMs - window length in ms
 * @param {number} opts.max - max requests per window per key
 * @param {(req) => string} [opts.key] - bucket key (default: client IP)
 * @param {string} [opts.message] - 429 message
 * @param {string} [opts.code] - 429 error code
 */
export const rateLimit = ({
  windowMs,
  max,
  key = (req) => req.ip,
  message = "Too many requests. Please try again later.",
  code = "RATE_LIMITED",
} = {}) => {
  if (!Number.isFinite(windowMs) || windowMs <= 0)
    throw new Error("rateLimit: windowMs must be a positive number");
  if (!Number.isFinite(max) || max <= 0)
    throw new Error("rateLimit: max must be a positive number");

  return (req, _res, next) => {
    let bucketKey;
    try {
      bucketKey = key(req);
    } catch {
      bucketKey = req.ip;
    }
    bucketKey = `${max}:${windowMs}:${bucketKey ?? req.ip}`;

    const now = Date.now();
    let entry = buckets.get(bucketKey);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((entry.resetAt - now) / 1000),
      );
      const err = ApiError.tooManyRequests(message, code);
      err.retryAfter = retryAfter;
      return next(err);
    }
    return next();
  };
};

// Authenticated-user key: falls back to IP when the token is missing/invalid
// (authMiddleware runs before these, so req.user is normally present).
export const userKey = (prefix) => (req) =>
  `${prefix}:${req.user?.id ?? req.ip}`;
