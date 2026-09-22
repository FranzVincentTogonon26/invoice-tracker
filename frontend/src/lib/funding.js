/* Budget-source ("budget reference") funding math.
 *
 * Shared by the Add Expenses form and its SelectSourceFund card so the balance
 * shown there and the balance the save is validated against can never drift
 * apart — one calculation, two consumers.
 */

/* Money columns arrive from pg as DECIMAL strings and SUM() over zero rows as
   NULL — coerce once so every comparison below is numeric. */
export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* Mirrors `Budget.referenceBalance()` / `Expenses.budgetReference()` on the
   server: a source can still spend `allocated − issued − expenses` (the same
   balance the AdminBudget overview uses). Recomputing it here only kicks in
   when the server didn't send a precomputed `balance`. */
export const withBalance = (reference) => {
  const allocated = toNumber(reference.allocated);
  const issued = toNumber(reference.issued);
  const expenses = toNumber(reference.expenses);
  return {
    ...reference,
    allocated,
    issued,
    expenses,
    balance:
      reference.balance == null
        ? allocated - issued - expenses
        : toNumber(reference.balance),
  };
};

/* The three funding states a draft can be in against its source:
   `insufficient` = the draft costs more than the source has left,
   `depleted`     = it uses the rest up exactly (or the source holds nothing),
   `funded`       = the source still covers everything typed in.
   `unselected` is the fourth, card-less state: nothing picked to compare. */
export const FUNDING_STATUS = {
  funded: "funded",
  depleted: "depleted",
  insufficient: "insufficient",
  unselected: "unselected",
};

/**
 * Resolves the budget source funding a draft and how it stands.
 *
 * `references` are raw `budget_reference` rows (with or without `balance`),
 * `referenceId` is the picked `reference_id` — with a single open source there
 * is nothing to pick, so that one is used as the fallback, exactly the way the
 * Add Expenses form mirrors it. `expenses` is the draft's running total.
 *
 * Returns the normalized `sources`, the resolved `source`, the money involved
 * (`expenses`, `balance`, `remaining`, `shortfall`), the share of the balance
 * the draft consumes (`used`, 0-100) and the `status` above.
 */
export const fundingState = (references = [], referenceId = "", expenses = 0) => {
  const sources = references.map(withBalance);
  const source =
    sources.find((item) => item.reference_id === referenceId) ??
    (sources.length === 1 ? sources[0] : null);

  const spent = toNumber(expenses);
  const balance = source?.balance ?? 0;
  const remaining = balance - spent;
  const insufficient = Boolean(source) && remaining < 0;
  const depleted = Boolean(source) && !insufficient && remaining <= 0;

  return {
    sources,
    source,
    expenses: spent,
    balance,
    remaining,
    shortfall: insufficient ? Math.abs(remaining) : 0,
    // Share of the balance this draft consumes — an unfunded source reads 100%.
    used: balance > 0 ? Math.min(100, Math.max(0, (spent / balance) * 100)) : 100,
    status: !source
      ? FUNDING_STATUS.unselected
      : insufficient
        ? FUNDING_STATUS.insufficient
        : depleted
          ? FUNDING_STATUS.depleted
          : FUNDING_STATUS.funded,
  };
};

/**
 * Sources that could still absorb the draft, best (largest balance) first —
 * the one-tap alternatives offered when the picked source can't cover it.
 */
export const fundingAlternatives = (sources = [], selectedId = "", expenses = 0) =>
  sources
    .filter(
      (source) =>
        source.reference_id !== selectedId && source.balance >= toNumber(expenses),
    )
    .sort((a, b) => b.balance - a.balance);
