import bcrypt from "bcryptjs";
import { query } from "../config/db.js";

// Columns safe to return in API responses (never exposes password)
const SAFE_COLUMNS = "user_id, name, email, avatar_url, role, status";
const SALT_ROUNDS = 10;

class User {
  //   Find User by id
  static async findUserById(id) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE user_id = $1`,
      [id],
    );
    return result.rows[0];
  }

  // Find User by Email (includes password hash — callers must strip before responding)
  static async findUserByEmail(email) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS}, password FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  // Create User (hashes the plaintext password before storing)
  static async createUser({ name, email, password }) {
    let role,
      status = null;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const countUsers = await query(`SELECT COUNT(*) FROM users`);
    if (parseInt(countUsers.rows[0].count) === 0) {
      // If this is the first user, make them an admin and active by default
      role = "admin";
      status = "active";
    } else {
      // Otherwise, new users are created with a pending status and no role
      role = "employee";
      status = "pending";
    }

    const result = await query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SAFE_COLUMNS}`,
      [name, email, hashedPassword, role, status],
    );
    return result.rows[0];
  }
}

export default User;
