import Budget from "../models/budget.model.js";
import Transactions from "../models/transactions.model.js";
import ApiError from "../utils/ApiError.js";
import { logTransaction } from "../utils/transactionLogger.js";
import { extractVisitorContext } from "../middleware/securityGuard.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/public/source-funds/:referenceId
 * Isolated public read-only source overview endpoint for all visitors.
 * Protected by securityGuard (WAF), publicOverviewLimiter (Rate Limit), and parameterized SQL.
 */
export const getPublicSourceOverview = async (req, res, next) => {
  try {
    const { referenceId } = req.params;

    if (!referenceId || !UUID_RE.test(String(referenceId).trim())) {
      throw ApiError.badRequest(
        "Invalid reference ID format. A valid UUID is required.",
        "INVALID_REFERENCE_ID",
      );
    }

    const cleanRefId = String(referenceId).trim();

    // Parameterized DB query strictly isolated to this reference_id
    const sources = await Budget.sourceFunds({ referenceId: cleanRefId });
    if (!sources || sources.length === 0) {
      throw ApiError.notFound(
        "Source of funds not found or has been deactivated.",
        "SOURCE_NOT_FOUND",
      );
    }

    const rawSource = sources[0];

    // Transactions belonging strictly to this source
    const { transactions } = await Transactions.ledger({
      referenceId: cleanRefId,
    });

    // Strip sensitive fields (defense-in-depth)
    const sanitizedSource = {
      reference_id: rawSource.reference_id,
      label: rawSource.label,
      notes: rawSource.notes,
      status: rawSource.status,
      date_cut_off: rawSource.date_cut_off,
      created_at: rawSource.created_at,
      allocated: rawSource.allocated,
      issued: rawSource.issued,
      expenses: rawSource.expenses,
      employeeExpenses: rawSource.employeeExpenses,
      settledAbono: rawSource.settledAbono,
      forwarded: rawSource.forwarded,
      remaining: rawSource.remaining,
      transactions: rawSource.transactions,
      expenses_count: rawSource.expenses_count,
      budgets: rawSource.budgets,
      involved: (rawSource.involved ?? []).map((p) => ({
        user_id: p.user_id,
        name: p.name,
        avatar_url: p.avatar_url,
        role: p.role,
      })),
      involved_count: rawSource.involved_count,
    };

    const sanitizedTransactions = (transactions ?? []).map((tx) => ({
      key: tx.key,
      kind: tx.kind,
      id: tx.id,
      date: tx.date,
      description: tx.description,
      notes: tx.notes,
      amount: tx.amount,
      moneyIn: tx.moneyIn,
      moneyOut: tx.moneyOut,
      direction: tx.direction,
      status: tx.status,
      method: tx.method,
      referenceId: tx.referenceId,
      referenceLabel: tx.referenceLabel,
      categoryId: tx.categoryId,
      categoryName: tx.categoryName,
      employeeId: tx.employeeId,
      employeeName: tx.employeeName,
      employeeRole: tx.employeeRole,
      employeeAvatar: tx.employeeAvatar,
      counterpartyName: tx.counterpartyName,
      counterpartyRole: tx.counterpartyRole,
      approvedBy: tx.approvedBy,
      flagged: tx.flagged,
      expenseDate: tx.expenseDate,
      dateSettled: tx.dateSettled,
      receiptId: tx.receiptId,
      imageUrl: tx.imageUrl,
    }));

    // Extract visitor telemetry (IP, Device, Location)
    const visitor = extractVisitorContext(req, req.query);

    // Audit log public view into transactions.md
    logTransaction({
      action: "PUBLIC_VIEW",
      entity: "source-funds-share",
      actor: { name: `Visitor [${visitor.ip}]`, role: "guest" },
      message: `Viewed Source: "${sanitizedSource.label || "Untitled"}" (Ref: ${sanitizedSource.reference_id}) | IP: ${visitor.ip} | Device: ${visitor.device} | Location: ${visitor.location}`,
      metadata: {
        referenceId: sanitizedSource.reference_id,
        label: sanitizedSource.label,
        ip: visitor.ip,
        device: visitor.device,
        location: visitor.location,
      },
    });

    return res.status(200).json({
      source: sanitizedSource,
      transactions: sanitizedTransactions,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/public/action-log
 * Receives visitor user actions (search, print, share, filter) and records them in transactions.md.
 */
export const logPublicAction = async (req, res, next) => {
  try {
    const { referenceId, action, details, clientInfo } = req.body || {};

    if (!action || typeof action !== "string") {
      throw ApiError.badRequest("Action identifier is required", "INVALID_ACTION");
    }

    const cleanAction = String(action).slice(0, 50).trim();
    const cleanRefId = referenceId && UUID_RE.test(String(referenceId).trim())
      ? String(referenceId).trim()
      : "unknown";

    const cleanDetails = details ? String(details).slice(0, 200).trim() : "-";

    const visitor = extractVisitorContext(req, clientInfo);

    let actionCode = "PUBLIC_ACTION";
    let actionDesc = "Visitor Action";

    if (cleanAction === "search") {
      actionCode = "PUBLIC_SEARCH";
      actionDesc = `Searched: "${cleanDetails}"`;
    } else if (cleanAction === "print") {
      actionCode = "PUBLIC_PRINT";
      actionDesc = "Printed transaction summary";
    } else if (cleanAction === "share") {
      actionCode = "PUBLIC_SHARE";
      actionDesc = "Copied shareable link";
    } else if (cleanAction === "filter") {
      actionCode = "PUBLIC_FILTER";
      actionDesc = `Applied filter: ${cleanDetails}`;
    } else if (cleanAction === "view_details") {
      actionCode = "PUBLIC_VIEW_TX";
      actionDesc = `Inspected transaction details (${cleanDetails})`;
    }

    logTransaction({
      action: actionCode,
      entity: "source-funds-share",
      actor: { name: `Visitor [${visitor.ip}]`, role: "guest" },
      message: `${actionDesc} | Ref: ${cleanRefId} | IP: ${visitor.ip} | Device: ${visitor.device} | Location: ${visitor.location}`,
      metadata: {
        referenceId: cleanRefId,
        action: cleanAction,
        details: cleanDetails,
        ip: visitor.ip,
        device: visitor.device,
        location: visitor.location,
      },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};
