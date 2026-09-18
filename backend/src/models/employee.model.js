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
  static async removeCategory(id) {
    const result = await query(
      `DELETE FROM users
        WHERE user_id = $1 AND role = 'employee'
        RETURNING ${this.SAFE_COLUMNS}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  //   Find Employee List (admin management view).
  //   Optional filters:
  //     - `search`: matched against name and email (ILIKE)
  //     - `status`: 'active' | 'pending' | 'inactive' | 'all'; when omitted
  //       (the budget page calls this with no args) it defaults to 'active'
  //       so the "Budget Issued" employee picker only lists active accounts.
  //   Each row carries the employee's issued-budget total (issued_budget rows
  //   joined through open budget_issued_reference rows) so the UI can show how
  //   much funding has been handed out to them.
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
          (
            SELECT COUNT(*)
            FROM budget_issued_reference bir2
            WHERE bir2.user_id = u.user_id
          )::int AS issued_references
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
