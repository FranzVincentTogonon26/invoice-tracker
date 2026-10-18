import Transactions from "../models/transactions.model.js";

// GET /transactions — the unified admin ledger. Every money movement in the
// system (budget given, budget issued, expenses, abono, budget-transfer sent
// + received legs) normalized to one list, newest first, plus the all-time
// gross summary and the category / reference lists the filters are built
// from. Admin-only at the route layer.
export const transactions = async (req, res, next) => {
  try {
    // `includeClosed=true` lifts the "closed sources leave no footsteps"
    // gate so a closed source's history still renders. Sent by the Source
    // of Funds overview page and the Reports library (a report counts every
    // reference regardless of status); every other ledger consumer keeps
    // the default hidden behavior.
    const includeClosed = String(req.query.includeClosed ?? "") === "true";
    const { transactions, summary, categories, references } =
      await Transactions.ledger({ includeClosed });
    return res.status(200).json({
      transactions,
      summary,
      categories,
      references,
    });
  } catch (err) {
    next(err);
  }
};
