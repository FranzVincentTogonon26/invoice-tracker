import { query } from "../config/db.js";

class Otp {
  // Replaces any previous code — a user only ever has one active OTP
  static async upsert({ email, otpHash, expiresAt }) {
    const result = await query(
      `INSERT INTO otp (email, otp, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET otp = EXCLUDED.otp,
             expires_at = EXCLUDED.expires_at,
             created_at = NOW()
       RETURNING email, expires_at, created_at`,
      [email, otpHash, expiresAt],
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await query(
      `SELECT email, otp, expires_at, created_at
       FROM otp WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  // One-time use: the row is removed once a code is verified
  static async deleteByEmail(email) {
    await query(`DELETE FROM otp WHERE email = $1`, [email]);
  }
}

export default Otp;
