import ApiError from "../utils/ApiError.js";
import { logTransaction } from "../utils/transactionLogger.js";

/**
 * Parses client IP, device, and location context from request headers and hints.
 */
export function extractVisitorContext(req, clientInfo = {}) {
  // IP resolution
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      req.ip ||
      "unknown";

  const ip =
    rawIp === "::1" || rawIp === "::ffff:127.0.0.1"
      ? "127.0.0.1 (Local)"
      : rawIp;

  // Device & User-Agent parsing
  const ua =
    req.headers["user-agent"] || clientInfo.userAgent || "Unknown Device";
  let device = clientInfo.device || "";

  if (!device && ua) {
    let os = "Unknown OS";
    if (/iPhone/i.test(ua)) os = "iPhone iOS";
    else if (/iPad/i.test(ua)) os = "iPad iOS";
    else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
    else if (/Windows NT 10\.0/i.test(ua)) os = "Windows 10/11";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/Linux/i.test(ua)) os = "Linux";

    let browser = "Browser";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua)) browser = "Chrome";
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";

    device = `${browser} on ${os}`;
  } else if (!device) {
    device = "Desktop Browser";
  }

  // Location / Timezone extraction
  const countryHeader =
    req.headers["cf-ipcountry"] || req.headers["x-country"] || "";
  const tz =
    clientInfo.timezone || req.headers["x-client-tz"] || "UTC";
  const location =
    clientInfo.location ||
    (countryHeader ? `${countryHeader} (${tz})` : tz);

  return {
    ip,
    device,
    location,
    userAgent: ua,
  };
}

// Common penetration attack signatures
const SQLI_PATTERNS = [
  /(\b(union(\s+all)?\s+select|select\s+.*\s+from|insert\s+into|delete\s+from|drop\s+table|update\s+.*\s+set|alter\s+table)\b)/i,
  /(--|\/\*|\*\/|;\s*(select|drop|delete|insert|update|alter|truncate))/i,
  /(\b(or|and)\b\s+['"]?[\w]+['"]?\s*=\s*['"]?[\w]+['"]?)/i,
  /(\b(exec(\s|\+)+(s|x)p\w+|benchmark\s*\(|pg_sleep\s*\(|sleep\s*\()\b)/i,
  /(char\(\d+\)|concat\s*\(|version\s*\(\)|load_file\s*\()/i,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript\s*:/i,
  /on(load|error|click|mouseover|submit|focus)\s*=/i,
  /<(iframe|embed|object|svg\s+onload)/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /(\.\.[\/\\])/,
  /(\/etc\/(passwd|shadow|hosts))/i,
  /(c:\\windows\\system32)/i,
];

const COMMAND_INJECTION_PATTERNS = [
  /(;|\||`|\$\(.*\)|\${.*})\s*(cat|ls|rm|chmod|chown|wget|curl|bash|sh|nc)\b/i,
];

function inspectString(val) {
  if (typeof val !== "string") return null;
  const decoded = decodeURIComponentSafe(val);

  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(decoded)) return `SQL Injection token: ${pattern.toString()}`;
  }
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(decoded)) return `XSS token: ${pattern.toString()}`;
  }
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(decoded)) return `Path Traversal token: ${pattern.toString()}`;
  }
  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(decoded)) return `Command Injection token: ${pattern.toString()}`;
  }
  return null;
}

function decodeURIComponentSafe(val) {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

function scanObject(obj, depth = 0) {
  if (!obj || depth > 4) return null;
  if (typeof obj === "string") return inspectString(obj);

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const match = scanObject(item, depth + 1);
      if (match) return match;
    }
  } else if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      const keyMatch = inspectString(key);
      if (keyMatch) return keyMatch;
      const valMatch = scanObject(value, depth + 1);
      if (valMatch) return valMatch;
    }
  }
  return null;
}

/**
 * Security Guard Middleware
 * Automatically audits and seals the database against penetration attempts,
 * SQL injections, XSS, and path traversal on public endpoints.
 */
export function securityGuard(req, res, next) {
  const violation =
    inspectString(req.originalUrl) ||
    scanObject(req.params) ||
    scanObject(req.query) ||
    scanObject(req.body);

  if (violation) {
    const context = extractVisitorContext(req);
    const summary = `Blocked malicious attempt: [${violation}] on ${req.method} ${req.originalUrl} | IP: ${context.ip} | Device: ${context.device} | Location: ${context.location}`;

    logTransaction({
      action: "SECURITY_BLOCKED",
      entity: "penetration-guard",
      actor: { name: `Visitor [${context.ip}]`, role: "threat" },
      message: summary,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: context.ip,
        device: context.device,
        location: context.location,
        violation,
      },
    });

    return res.status(403).json({
      error: "Malicious payload detected by security guard. Request terminated.",
      code: "SECURITY_PENETRATION_BLOCKED",
      details: "Protected by system rate limiter and penetration guard.",
    });
  }

  next();
}
