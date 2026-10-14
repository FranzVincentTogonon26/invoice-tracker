import { apiClient } from "./client";

export function getClientTelemetry() {
  if (typeof window === "undefined") return {};
  const ua = navigator.userAgent || "";
  let device = "Desktop Browser";

  if (/iPhone/i.test(ua)) device = "iPhone iOS";
  else if (/iPad/i.test(ua)) device = "iPad iOS";
  else if (/Macintosh|Mac OS X/i.test(ua)) device = "macOS";
  else if (/Windows NT 10\.0/i.test(ua)) device = "Windows 10/11";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Linux/i.test(ua)) device = "Linux";

  let tz = "UTC";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    // fallback
  }

  const locale = navigator.language || "en-US";

  return {
    device,
    timezone: tz,
    locale,
    location: `${tz} (${locale})`,
    userAgent: ua,
  };
}

export const publicSourceApi = {
  getOverview: (referenceId) => {
    const telemetry = getClientTelemetry();
    return apiClient
      .get(`/public/source-funds/${encodeURIComponent(referenceId)}`, {
        params: telemetry,
      })
      .then((r) => r.data);
  },

  logAction: ({ referenceId, action, details }) => {
    const clientInfo = getClientTelemetry();
    return apiClient
      .post("/public/action-log", {
        referenceId,
        action,
        details,
        clientInfo,
      })
      .then((r) => r.data)
      .catch(() => {
        // Logging is best-effort and should never disrupt user experience
      });
  },
};
