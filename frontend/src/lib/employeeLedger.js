// Ledger row mappers shared by the employee pages and the Admin → Employee
// Details tabs.
//
// The employee-facing API returns raw `expenses` / `employee_abono` rows,
// while the transaction sections render a normalized "transaction" shape.
// The employee page (own records) and the admin details page (a selected
// employee's records) must feed the SAME shape into the SAME sections, so the
// mappers live here instead of being duplicated per page.

// Expenses → ledger row. Keeps the backdated `flag`, the receipt bits the
// View-expense modal needs (image + line items fetched by id) and the
// source-of-funds label.
export const expenseToTransaction = (exp) => ({
  kind: "expense",
  id: exp.id,
  description: exp.description,
  date: exp.expense_date,
  timeDate: exp.created_at,
  amount: Number(exp.total_amount) || 0,
  method: exp.payment_method,
  status: exp.status,
  // Backdated marker set by the backend (`expenses.flag = 1` when an
  // employee line is dated before their first issued budget). Exposed as
  // both `flag` (raw) and `flagged` (boolean) so the ledger can highlight
  // the row with a warning tone.
  flag: Number(exp.flag) || 0,
  flagged: Number(exp.flag) === 1,
  reference_label: exp.reference_label || "",
  notes: exp.notes || "",
  category: exp.category_name || "",
  category_name: exp.category_name,
  receiptId: exp.receipt_id,
  imageUrl: exp.image_url || "",
  sourceOfFunds: exp.reference_label || "",
  employee: exp.created_by,
  employeeRole: exp.created_by_role,
  employeeAvatar: exp.created_by_avatar,
});

// Abono → ledger row. Carries the raw `date_settled` so the details sheet can
// render its "Date Settled" row for settled entries (other statuses leave it
// null).
export const abonoToTransaction = (row) => ({
  kind: "abono",
  id: row.id,
  description: row.description,
  date: row.created_at,
  timeDate: row.created_at,
  amount: Number(row.amount) || 0,
  status: row.status,
  reference_label: row.reference_label || "",
  dateSettled: row.date_settled,
  notes: "",
  method: "cash",
  flag: 0,
  flagged: false,
});
