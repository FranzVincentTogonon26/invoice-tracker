import fs from "node:fs";
import ApiError from "../utils/ApiError.js";
import { LOG_FILE, formatDeviceTime } from "../utils/transactionLogger.js";

// Bound the read so a years-old log can never exhaust memory — the newest
// entries (what back-tracing cares about) are kept.
const MAX_LINES = 10000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Split a log row on `|` but ignore pipes the logger escaped (`\|`).
const splitRow = (line) =>
  line
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));

const parseRole = (actor) => {
  const m = /\(([^)]+)\)\s*$/.exec(String(actor ?? ""));
  const role = (m?.[1] ?? "").trim().toLowerCase();
  if (role === "admin" || role === "employee") return role;
  return "unknown";
};

const parseName = (actor) => {
  const s = String(actor ?? "");
  const m = /^(.*?)\s*\([^)]*\)\s*$/.exec(s);
  const name = (m?.[1] ?? s).trim();
  return name && name !== "-" ? name : "System";
};

// Device wall-clock rows the logger writes since the device-clock change:
// `10-05-2025 2:33:13 PM +08:00` (offset suffix keeps the instant
// recoverable). Legacy rows are plain UTC ISO strings — both parse.
const DEVICE_RE =
  /^(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)(?: ([+-])(\d{2}):(\d{2}))?$/;

const parseTimestamp = (raw) => {
  const s = String(raw ?? "").trim();
  // Strict device format first — Date.parse is lenient and could half-parse
  // `10-05-2025 ...` into the wrong instant (wrong day/month or dropped
  // offset), so it must never see these rows. Legacy UTC ISO rows fall
  // through to Date.parse below.
  const m = DEVICE_RE.exec(s);
  if (m) {
    const [, MM, DD, YYYY, h12, mm, ss, ampm, sign, offH, offM] = m;
    let h = Number(h12) % 12;
    if (ampm === "PM") h += 12;
    const wallUTC = Date.UTC(
      Number(YYYY),
      Number(MM) - 1,
      Number(DD),
      h,
      Number(mm),
      Number(ss),
    );
    if (Number.isNaN(wallUTC)) return null;
    const offMin = sign
      ? (sign === "-" ? -1 : 1) * (Number(offH) * 60 + Number(offM))
      : 0;
    if (Math.abs(offMin) > 840) return null;
    return { ms: wallUTC - offMin * 60000, display: s };
  }
  const iso = Date.parse(s);
  if (Number.isFinite(iso)) return { ms: iso, display: null };
  return null;
};
const parseLine = (line, index) => {
  const cells = splitRow(line);
  if (cells.length < 6) return null;
  const [timestampRaw, actionRaw, entityRaw, actorRaw, amountRaw, ...rest] =
    cells;
  // Accepts both the legacy UTC ISO rows and the newer device wall-clock
  // rows (`10-05-2025 2:33:13 PM +08:00`).
  const stamp = parseTimestamp(timestampRaw);
  if (!stamp) return null;
  const time = stamp.ms;
  const details = rest.join(" | ").trim() || "-";
  return {
    id: `${time}-${index}`,
    ms: time,
    timestamp: new Date(time).toISOString(),
    // Verbatim device wall clock when the row carries one; legacy rows get
    // their display formatted later in the viewer's timezone.
    display: stamp.display,
    date: new Date(time).toISOString().slice(0, 10),
    action: actionRaw.toLowerCase(),
    entity: entityRaw.toLowerCase(),
    actor: actorRaw === "-" ? "System" : actorRaw,
    actorName: parseName(actorRaw),
    role: parseRole(actorRaw),
    amount: amountRaw === "-" ? null : amountRaw,
    details,
  };
};

const readEntries = () => {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
  } catch {
    return [];
  }
  let text = "";
  try {
    text = fs.readFileSync(LOG_FILE, "utf8");
  } catch (err) {
    console.error("audit log read failed:", err?.message ?? err);
    return [];
  }
  // Newest rows live at the bottom of the file — keep the tail, parse, then
  // flip so index 0 is the most recent entry.
  const lines = text.split("\n").slice(-MAX_LINES);
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    if (
      line.startsWith("#") ||
      line.startsWith(">") ||
      line.startsWith("|---") ||
      line.startsWith("---")
    ) {
      continue;
    }
    const entry = parseLine(line, i);
    if (entry) entries.push(entry);
  }
  // Explicit newest-first sort on the instant (not the display string) so
  // the top rows are always the most recent activities, even if the file
  // ever holds out-of-order lines — never rely on append order alone.
  entries.sort((a, b) => b.ms - a.ms);
  return entries;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /audit-logs — every transaction/activity row from
// `backend/logs/transactions.md`, newest first. Admin-only at the route
// layer. Query params (all optional): `from` / `to` (YYYY-MM-DD, `to` is
// inclusive), `action`, `entity`, `role` (admin | employee), `actor`
// (substring on the actor name), `search` (substring across details, actor,
// entity, action, amount), `tz` (viewer device offset in minutes ahead of
// UTC — the From/To day window and "today" are evaluated in the device's
// calendar, not UTC's), `page`, `limit`.
export const list = async (req, res, next) => {
  try {
    const {
      from,
      to,
      action,
      entity,
      role,
      actor,
      search,
      tz,
      page = "1",
      limit = String(DEFAULT_LIMIT),
    } = req.query ?? {};

    if (from && !DAY_RE.test(from))
      throw ApiError.badRequest("Invalid from date", "VALIDATION_ERROR");
    if (to && !DAY_RE.test(to))
      throw ApiError.badRequest("Invalid to date", "VALIDATION_ERROR");

    // Device clock alignment: the file stores UTC, but the viewer picked
    // calendar days on THEIR device. With their offset we translate the day
    // window to UTC millis for comparison. Falls back to plain UTC-day
    // comparison when the param is missing/invalid.
    const tzRaw = Number.parseInt(tz, 10);
    const tzMin = Number.isFinite(tzRaw)
      ? Math.max(-720, Math.min(840, tzRaw))
      : null;
    const dayMs = 24 * 60 * 60 * 1000;
    const fromStart =
      tzMin !== null && from
        ? Date.parse(`${from}T00:00:00Z`) - tzMin * 60000
        : null;
    const toEnd =
      tzMin !== null && to
        ? Date.parse(`${to}T00:00:00Z`) + dayMs - tzMin * 60000
        : null;

    const all = readEntries();

    const q = String(search ?? "").trim().toLowerCase();
    const actorQ = String(actor ?? "").trim().toLowerCase();

    const filtered = all.filter((entry) => {
      const t = Date.parse(entry.timestamp);
      if (fromStart !== null && !(t >= fromStart)) return false;
      if (toEnd !== null && !(t < toEnd)) return false;
      if (fromStart === null && from && entry.date < from) return false;
      if (toEnd === null && to && entry.date > to) return false;
      if (action && action !== "all" && entry.action !== String(action).toLowerCase())
        return false;
      if (entity && entity !== "all" && entry.entity !== String(entity).toLowerCase())
        return false;
      if (role && role !== "all" && entry.role !== String(role).toLowerCase())
        return false;
      if (actorQ && !entry.actorName.toLowerCase().includes(actorQ)) return false;
      if (q) {
        const haystack =
          `${entry.details} ${entry.actor} ${entry.actorName} ${entry.entity} ${entry.action} ${entry.amount ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const safeLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / safeLimit));
    const safePage = Math.min(Math.max(Number.parseInt(page, 10) || 1, 1), pageCount);

    const start = (safePage - 1) * safeLimit;
    // `display` is the verbatim device wall clock for new rows
    // (`10-05-2025 2:33:13 PM +08:00`); legacy ISO rows are formatted here
    // in the viewer's timezone so everything reads one way.
    const logs = filtered.slice(start, start + safeLimit).map((entry) => {
      const { ms, ...rest } = entry;
      return {
        ...rest,
        display: entry.display ?? formatDeviceTime(ms, tzMin ?? 0),
      };
    });

    const byAction = {};
    const byEntity = {};
    const byRole = { admin: 0, employee: 0, unknown: 0 };
    let today = 0;
    // "Today" on the viewer's device calendar, not UTC's.
    const todayStr =
      tzMin !== null
        ? new Date(Date.now() + tzMin * 60000).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const entryDay = (entry) => {
      if (tzMin === null) return entry.date;
      const t = Date.parse(entry.timestamp);
      if (Number.isNaN(t)) return entry.date;
      return new Date(t + tzMin * 60000).toISOString().slice(0, 10);
    };
    for (const entry of all) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
      byEntity[entry.entity] = (byEntity[entry.entity] ?? 0) + 1;
      if (entry.role === "admin" || entry.role === "employee") byRole[entry.role] += 1;
      else byRole.unknown += 1;
      if (entryDay(entry) === todayStr) today += 1;
    }

    return res.status(200).json({
      logs,
      total: filtered.length,
      page: safePage,
      limit: safeLimit,
      pageCount,
      stats: { total: all.length, today, byAction, byEntity, byRole },
      facets: {
        actions: Object.keys(byAction).sort(),
        entities: Object.keys(byEntity).sort(),
      },
    });
  } catch (err) {
    next(err);
  }
};
