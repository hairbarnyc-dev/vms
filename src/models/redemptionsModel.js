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

export const getByVoucherId = async (voucher_id, conn = null) => {
  const db = conn || pool
  const [rows] = await db.query(
    'SELECT id, voucher_id FROM redemptions WHERE voucher_id=? AND is_deleted=0 LIMIT 1',
    [voucher_id]
  )
  return rows[0] || null
}

export const redeemLegacy = async ({ voucher_id, salon_id, staff_user_id, redeemed_at, notes }, conn = null) => {
  const db = conn || pool
  await db.query(
    'INSERT INTO redemptions (voucher_id, salon_id, staff_user_id, redeemed_at, notes) VALUES (?,?,?,?,?)',
    [voucher_id, salon_id, staff_user_id, redeemed_at || null, notes || null]
  )
  await db.query('UPDATE vouchers SET status="REDEEMED" WHERE id=? AND is_deleted=0', [voucher_id])
}
