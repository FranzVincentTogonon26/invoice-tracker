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
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING ${SAFE_COLUMNS}`,
      [name, email, hashedPassword],
    );
    return result.rows[0];
  }
}

export default User;
