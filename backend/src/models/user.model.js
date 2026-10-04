import bcrypt from "bcryptjs";
import { query, withTransaction } from "../config/db.js";

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

  // Find User by email, excluding one user_id — the email-uniqueness check
  // when the signed-in employee changes their own email (their current row
  // must NOT count as a conflict).
  static async findUserByEmailExceptId(email, id) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE email = $1 AND user_id <> $2`,
      [email, id],
    );
    return result.rows[0];
  }

  // Find User WITH the password hash by id — ONLY the change-password flow
  // needs it (to bcrypt-compare the current password before replacing it).
  // Same contract as findUserByEmail: callers must never respond with it.
  static async findUserWithPasswordById(id) {
    const result = await query(
      `SELECT ${SAFE_COLUMNS}, password FROM users WHERE user_id = $1`,
      [id],
    );
    return result.rows[0];
  }

  // Update the signed-in employee's own account info (Setting → Account):
  // name, email and avatar_url. `avatarUrl` is the final value the controller
  // resolved (new upload URL, the stored URL, or NULL when the photo was
  // removed), so the statement never has to branch. `status = 'active'` is
  // re-checked in the WHERE clause as a last guard: if the account was
  // deactivated mid-request the UPDATE matches nothing and returns null.
  static async updateUserAccount({ id, name, email, avatarUrl }) {
    const result = await query(
      `UPDATE users
          SET name = $2,
              email = $3,
              avatar_url = $4,
              updated_at = NOW()
        WHERE user_id = $1 AND status = 'active'
        RETURNING ${SAFE_COLUMNS}`,
      [id, name, email, avatarUrl],
    );
    return result.rows[0] ?? null;
  }

  // Admin avatar change (Admin → Employee Details): replaces ONLY avatar_url.
  // No active-status gate — an admin may manage accounts of any status, and
  // the route is already admin-only with the target id re-validated.
  static async updateUserAvatar({ id, avatarUrl }) {
    const result = await query(
      `UPDATE users
          SET avatar_url = $2,
              updated_at = NOW()
        WHERE user_id = $1
        RETURNING ${SAFE_COLUMNS}`,
      [id, avatarUrl],
    );
    return result.rows[0] ?? null;
  }

  // Replace the user's password — hashed with the SAME procedure and cost as
  // createUser (bcrypt, SALT_ROUNDS), so a password set here is verified by
  // the existing login flow with `bcrypt.compare`. The plaintext never
  // touches the database (users.password stores only the hash).
  static async updateUserPassword({ id, password }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `UPDATE users
          SET password = $2,
              updated_at = NOW()
        WHERE user_id = $1 AND status = 'active'
        RETURNING ${SAFE_COLUMNS}`,
      [id, hashedPassword],
    );
    return result.rows[0] ?? null;
  }

  // Create User (hashes the plaintext password before storing).
  // The first-ever user becomes an active admin (initial bootstrap);
  // everyone else starts as a pending employee awaiting approval. The
  // bootstrap check runs under a transaction-scoped advisory lock so
  // concurrent registrations serialize here — exactly one of them can
  // observe zero users and mint admin (a plain COUNT-then-INSERT would let
  // two racers both see zero).
  static async createUser({ name, email, password }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    return withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('user_bootstrap'))",
      );
      const countUsers = await client.query(`SELECT COUNT(*) FROM users`);
      const isFirst = parseInt(countUsers.rows[0].count, 10) === 0;

      const result = await client.query(
        `INSERT INTO users (name, email, password, role, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SAFE_COLUMNS}`,
        [
          name,
          email,
          hashedPassword,
          isFirst ? "admin" : "employee",
          isFirst ? "active" : "pending",
        ],
      );
      return result.rows[0];
    });
  }
}

export default User;
