import bcrypt from "bcryptjs";
import { query } from "../config/db.js";

const SALT_ROUNDS = 10;

class Employee {
  // Columns safe to return in API responses (never exposes the password hash)
  static SAFE_COLUMNS = "user_id, name, email, avatar_url, role, status";

  //   Find Employee by id
  static async findEmployeeById(id) {
    const result = await query(
      `SELECT ${this.SAFE_COLUMNS} FROM users WHERE user_id = $1`,
      [id],
    );
    return result.rows[0];
  }

  //   Find Employee by email (used to catch duplicate accounts on create)
  static async findEmployeeByEmail(email) {
    const result = await query(
      `SELECT ${this.SAFE_COLUMNS} FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  //   Create Employee — the admin provisions the account directly, so the
  //   employee is created with role 'employee' and status 'active' (they can
  //   sign in immediately with the provided credentials).
  static async createEmployee({ name, email, password }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, 'employee', 'pending')
       RETURNING ${this.SAFE_COLUMNS}`,
      [name, email, hashedPassword],
    );
    return result.rows[0];
  }

  //   Update an employee's account status ('active' | 'inactive') — also the
  //   "approve" path for self-registered employees (pending -> active).
  static async updateEmployeeStatus({ id, status }) {
    const result = await query(
      `UPDATE users
          SET status = $2,
              updated_at = NOW()
        WHERE user_id = $1 AND role = 'employee'
        RETURNING ${this.SAFE_COLUMNS}`,
      [id, status],
    );
    return result.rows[0] ?? null;
  }

  //   Remove an employee account. Budget references issued to the user are
  //   cascaded away by `budget_issued_reference.user_id ON DELETE CASCADE`.
  static async removeEmployee(id) {
    const result = await query(
      `DELETE FROM users
        WHERE user_id = $1 AND role = 'employee'
        RETURNING ${this.SAFE_COLUMNS}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  // How many `budget_issued_reference` rows point at this user — the delete
  // guard. Anything above zero means issuance history exists and the account
  // must be kept (deactivate instead of delete).
  static async countIssuedReferences(id) {
    const result = await query(
      `SELECT COUNT(*)::int AS count
         FROM budget_issued_reference
        WHERE user_id = $1`,
      [id],
    );
    return result.rows[0]?.count ?? 0;
  }

  //   Find Employee List (admin management view).
  //   Optional filters:
  //     - `search`: matched against name and email (ILIKE)
  //     - `status`: 'active' | 'pending' | 'inactive' | 'all'; when omitted
  //       (the budget page calls this with no args) it defaults to 'active'
  //       so the "Budget Issued" employee picker only lists active accounts.
  //   Each row carries the employee's budget figures, every one of them keyed
  //   on that row's `user_id` and computed with the SAME definitions the
  //   employee's own Overview page uses — models/employee.overview.model.js is
  //   the canonical reference for all five:
  //     - `issued_budget`: SUM(issued_budget.amount) through the employee's
  //                        OPEN budget_issued_reference rows ("Issued Budget")
  //     - `total_spent`:   SUM(expenses.total_amount) of PAID rows only, so a
  //                        soft-deleted row parked in 'draft' or a voided one
  //                        in 'cancel' never reads as spent ("Total Spent")
  //     - `total_abono`:   SUM(employee_abono.amount) of OPEN rows only — a
  //                        settled (reimbursed) or draft abono no longer funds
  //                        spending
  //     - `total_sent` / `total_received`: SUCCESS budget_transfer rows sent
  //                        by / received for this employee (a 'cancel' row is
  //                        an audit trail and never counts)
  //     - `remaining_balance`: issued + OPEN abono − PAID expenses − sent
  //                        transfers + received transfers — the SAME balance
  //                        the employee sees on their own Overview page. The
  //                        old `issued − spent` shortcut ignored abono and
  //                        transfers, so an employee who received a transfer
  //                        (or still holds an unsettled abono) showed a
  //                        different Remaining figure here than on their own
  //                        Overview.
  //   `issued_references` (the table's "Transactions" column) counts the
  //   employee's `issued_budget` rows — the real issuance transactions,
  //   wired through their parents via
  //   `issued_budget.issued_ref_id = budget_issued_reference.id` — and NOT the
  //   parent `budget_issued_reference` rows themselves: repeated same-source
  //   top-ups reuse one OPEN parent (migration 003), so counting parents
  //   undercounted every multi-issuance employee (2 issuances read as 1).
  static async employeeList({ search, status } = {}) {
    const where = [];
    const params = [];

    where.push("u.role = 'employee'");
    if (status && status !== "all") {
      params.push(status);
      where.push(`u.status = $${params.length}`);
    } else if (!status) {
      // No explicit filter (budget page) → only active employees.
      where.push("u.status = 'active'");
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where.push(
        `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
      );
    }

    // `::float8` casts DECIMAL (returned by pg as strings) to a JS number.
    const result = await query(
      `SELECT
          u.user_id,
          u.name,
          u.email,
          u.avatar_url,
          u.role,
          u.status,
          u.created_at,
          COALESCE((
            SELECT SUM(ib.amount)
            FROM issued_budget ib
            JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
            WHERE bir.user_id = u.user_id AND bir.status = 'open'
          ), 0)::float8 AS issued_budget,
          COALESCE((
            SELECT SUM(e.total_amount)
            FROM expenses e
            WHERE e.user_id = u.user_id AND e.status = 'paid'
          ), 0)::float8 AS total_spent,
          COALESCE((
            SELECT SUM(ea.amount)
            FROM employee_abono ea
            WHERE ea.user_id = u.user_id AND ea.status = 'open'
          ), 0)::float8 AS total_abono,
          COALESCE((
            SELECT SUM(bt.amount)
            FROM budget_transfer bt
            WHERE bt.user_id = u.user_id AND bt.status = 'success'
          ), 0)::float8 AS total_sent,
          COALESCE((
            SELECT SUM(btr.amount)
            FROM budget_transfer btr
            WHERE btr.transfer_to = u.user_id AND btr.status = 'success'
          ), 0)::float8 AS total_received,
          -- Same formula as EmployeeOverview.totalBalance over the same five
          -- per-user aggregates above, so the admin "Remaining" column and the
          -- employee's own Overview balance can never disagree.
          (
            COALESCE((
              SELECT SUM(ib.amount)
              FROM issued_budget ib
              JOIN budget_issued_reference bir ON ib.issued_ref_id = bir.id
              WHERE bir.user_id = u.user_id AND bir.status = 'open'
            ), 0)
            + COALESCE((
              SELECT SUM(ea.amount)
              FROM employee_abono ea
              WHERE ea.user_id = u.user_id AND ea.status = 'open'
            ), 0)
            - COALESCE((
              SELECT SUM(e.total_amount)
              FROM expenses e
              WHERE e.user_id = u.user_id AND e.status = 'paid'
            ), 0)
            - COALESCE((
              SELECT SUM(bt.amount)
              FROM budget_transfer bt
              WHERE bt.user_id = u.user_id AND bt.status = 'success'
            ), 0)
            + COALESCE((
              SELECT SUM(btr.amount)
              FROM budget_transfer btr
              WHERE btr.transfer_to = u.user_id AND btr.status = 'success'
            ), 0)
          )::float8 AS remaining_balance,
          (
            SELECT COUNT(*)
            FROM issued_budget ib2
            JOIN budget_issued_reference bir2 ON ib2.issued_ref_id = bir2.id
            WHERE bir2.user_id = u.user_id
          )::int AS issued_references,
          -- Parent issuance rows for this user, any status — the delete guard:
          -- an employee who was ever issued budget keeps their history, so the
          -- account must not be removable (the menu hides Delete for them).
          (
            SELECT COUNT(*)
            FROM budget_issued_reference bir3
            WHERE bir3.user_id = u.user_id
          )::int AS issued_reference_count
       FROM users u
       WHERE ${where.join(" AND ")}
       ORDER BY u.created_at DESC`,
      params,
    );
    return result.rows;
  }

  //   Overview stats for the admin Employees dashboard.
  //   `totalEmployeeIssued` is the total funding actually handed out to
  //   employees: SUM(issued_budget.amount) joined through open
  //   budget_issued_reference rows (the "Total Budget Issued" StatCard).
  static async employeeOverview() {
    const counts = await query(
      `SELECT
          COUNT(*) FILTER (WHERE role = 'employee')::int AS total_employees,
          COUNT(*) FILTER (WHERE role = 'employee' AND status = 'active')::int AS active_employees,
          COUNT(*) FILTER (WHERE role = 'employee' AND status = 'pending')::int AS pending_approval,
          COUNT(*) FILTER (WHERE role = 'employee' AND status = 'inactive')::int AS inactive_employees
       FROM users`,
      [],
    );

    const budget = await query(
      `SELECT
          COALESCE((
            SELECT SUM(b.amount) FROM budget b WHERE b.status != 'cancelled'
          ), 0) AS total_allocated,
          COALESCE((
            SELECT SUM(i.amount)
            FROM issued_budget i
            JOIN budget_issued_reference bir ON i.issued_ref_id = bir.id
            WHERE bir.status = 'open'
          ), 0) AS total_issued`,
      [],
    );

    const c = counts.rows[0] ?? {};
    const b = budget.rows[0] ?? { total_allocated: 0, total_issued: 0 };
    // The card asks for the total ISSUED amount — NOT `allocated - issued`,
    // which is the *remaining* (un-issued) budget.
    const issued = Number(b.total_issued) || 0;

    return {
      totalEmployees: Number(c.total_employees) || 0,
      activeEmployees: Number(c.active_employees) || 0,
      pendingApproval: Number(c.pending_approval) || 0,
      inactiveEmployees: Number(c.inactive_employees) || 0,
      totalEmployeeIssued: issued,
    };
  }
}

export default Employee;
