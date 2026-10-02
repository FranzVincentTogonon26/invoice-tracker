// Shared budget breakdown for the admin Employees views (table rows AND the
// read-only profile modal) so both always render the same figures.
//
// Every value comes straight from the ledger row and is keyed on that row's
// `user_id` server-side (Employee.employeeList), using the SAME definitions as
// the employee's own Overview page (the canonical reference):
//   - issued:    SUM(issued_budget) through the employee's OPEN
//                budget_issued_reference rows
//   - spent:     SUM(expenses.total_amount) of PAID rows only — a row parked
//                in 'draft' or voided in 'cancel' never counts as spent
//   - remaining: issued + OPEN abono − PAID expenses − SUCCESS transfers sent
//                + SUCCESS transfers received (= EmployeeOverview.totalBalance)
//   - received:  SUCCESS budget transfers the employee received — funding that
//                sits ON TOP of the issued budget (= EmployeeOverview's
//                `totalReceived`); 0 when the employee never received one.
//   - abono:     OPEN abono the employee still holds — spendable funding on
//                top of the issued budget (= EmployeeOverview's `totalAbono`;
//                rendered with the same warning tone the Overview's Abono
//                stat uses); 0 when the employee holds none.
//
//   - funded:    total funding behind the pool (issued + OPEN abono +
//                SUCCESS transfers received) — the percentage base
//   - remaining: received + OPEN abono + issued − PAID expenses − SUCCESS
//                transfers sent (= EmployeeOverview.totalBalance) — the exact
//                figure behind formatMoney(remaining)
//   - share:     remaining share of total funding, kept at 2 decimals
//                (e.g. 99.05) so the pill and the bar agree exactly with the
//                displayed remaining figure
//   - spentShare: spent share of total funding (100 − share), pinned 0–100,
//                2 decimals — what the pill prints and the bar fills
//
// Centavos rounding shared with the server so a fully-spent balance reads
// exactly 0 instead of a floating-point residue.
const toMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export function budgetBreakdown(employee) {
  const issued = Math.max(0, toMoney(employee?.issued_budget));
  const spent = Math.max(0, toMoney(employee?.total_spent));
  const received = Math.max(0, toMoney(employee?.total_received));
  const abono = Math.max(0, toMoney(employee?.total_abono));
  const sent = Math.max(0, toMoney(employee?.total_sent));

  const funded = toMoney(issued + abono + received);
  const remaining = toMoney(received + abono + issued - spent - sent);

  const share =
    funded > 0 ? Number(((remaining / funded) * 100).toFixed(2)) : 0;
  const spentShare =
    funded > 0
      ? Number(Math.min(100, Math.max(0, 100 - share)).toFixed(2))
      : 0;

  return {
    issued,
    spent,
    remaining,
    received,
    abono,
    sent,
    funded,
    share,
    spentShare,
  };
}
