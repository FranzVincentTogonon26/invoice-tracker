import { query } from "../config/db.js";

class Employee {
  static SAFE_COLUMNS = "user_id, name, email, avatar_url, role, status";

  //   Find Employee by id
  static async findEmployeeById(id) {
    const result = await query(
      `SELECT ${this.SAFE_COLUMNS} FROM users WHERE user_id = $1`,
      [id],
    );
    return result.rows[0];
  }

  //   Find Employee List
  static async employeeList() {
    // SAFE_COLUMNS — `SELECT *` would leak the password hash
    const result = await query(
      `SELECT ${this.SAFE_COLUMNS} FROM users WHERE role = 'employee' AND status='active'`,
      [],
    );
    return result.rows;
  }
}

export default Employee;
