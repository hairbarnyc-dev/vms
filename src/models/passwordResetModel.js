import { pool } from '../config/db.js'

export const createOtp = async ({ user_id, email, otp_code, expiresAt, resendAfter }) => {
  const [res] = await pool.query(
    `INSERT INTO password_resets (user_id, email, otp_code, otp_expires_at, resend_after, used)
     VALUES (?,?,?,?,?,0)`,
    [user_id || null, email, otp_code, expiresAt, resendAfter]
  )
  return res.insertId
}

export const getLatestForEmail = async (email) => {
  const [rows] = await pool.query(
    `SELECT * FROM password_resets
     WHERE email=? AND used=0
     ORDER BY id DESC LIMIT 1`,
    [email]
  )
  return rows[0] || null
}

export const markUsed = async (id) => {
  await pool.query('UPDATE password_resets SET used=1 WHERE id=?', [id])
}
