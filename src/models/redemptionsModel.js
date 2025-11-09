import { pool } from '../config/db.js'

export const redeem = async ({ voucher_id, salon_id, staff_user_id, notes }) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      'INSERT INTO redemptions (voucher_id, salon_id, staff_user_id, notes) VALUES (?,?,?,?)',
      [voucher_id, salon_id, staff_user_id, notes || null]
    )
    await conn.query('UPDATE vouchers SET status="REDEEMED" WHERE id=? AND is_deleted=0', [voucher_id])
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
