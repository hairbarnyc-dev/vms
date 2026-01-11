import { pool } from '../config/db.js'

export const createVoucher = async (data, conn = null) => {
  const { code, salon_id, order_id, customer_id, title, face_value, currency, expires_at, created_at } = data
  const db = conn || pool
  const fields = ['code', 'salon_id', 'order_id', 'customer_id', 'title', 'face_value', 'currency', 'expires_at']
  const values = [code, salon_id || null, order_id || null, customer_id || null, title, face_value || 0, currency || 'CAD', expires_at]
  if (created_at) {
    fields.push('created_at')
    values.push(created_at)
  }
  const placeholders = fields.map(() => '?').join(',')
  const [res] = await db.query(
    `INSERT INTO vouchers (${fields.join(',')}) VALUES (${placeholders})`,
    values
  )
  return res.insertId
}

export const getByCode = async (code, conn = null) => {
  const db = conn || pool
  const [rows] = await db.query(
    `SELECT v.*, s.name AS salon_name,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            c.email AS customer_email,
            c.phone AS customer_phone
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN customers c ON c.id=v.customer_id
     WHERE v.code=? AND v.is_deleted=0
     LIMIT 1`,
    [code]
  )
  return rows[0]
}
export const getByOrderId = async (order_id, conn = null) => {
  if (!order_id) return null
  const db = conn || pool
  const [rows] = await db.query(
    `SELECT v.id, v.code
     FROM vouchers v
     WHERE v.order_id=? AND v.is_deleted=0
     LIMIT 1`,
    [order_id]
  )
  return rows[0]
}
export const getById = async (id) => {
  const [rows] = await pool.query(
    `SELECT v.*, s.name AS salon_name,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            c.email AS customer_email,
            c.phone AS customer_phone
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN customers c ON c.id=v.customer_id
     WHERE v.id=? AND v.is_deleted=0`,
    [id]
  )
  return rows[0]
}

const buildWhere = ({ q, status, salon_id, date_from, date_to } = {}) => {
  const params = []
  const where = ['v.is_deleted=0']
  if (q) { where.push('(v.code LIKE ? OR v.title LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (status) { where.push('v.status=?'); params.push(status) }
  if (salon_id) {
    where.push('(v.salon_id=? OR r.salon_id=?)')
    params.push(Number(salon_id), Number(salon_id))
  }
  if (date_from) { where.push('v.created_at>=?'); params.push(new Date(date_from)) }
  if (date_to) { where.push('v.created_at<?'); params.push(new Date(date_to)) }
  return { where, params }
}

export const list = async ({ page = 1, pageSize = 20, q, status, salon_id, date_from, date_to }) => {
  const offset = (page - 1) * pageSize
  const { where, params } = buildWhere({ q, status, salon_id, date_from, date_to })

  const [rows] = await pool.query(
    `SELECT v.*, COALESCE(rs.name, s.name) AS salon_name,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            o.order_id AS order_number,
            o.external_id AS order_external_id,
            o.source AS order_source
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN redemptions r ON r.voucher_id=v.id AND r.is_deleted=0
     LEFT JOIN salons rs ON rs.id=r.salon_id
     LEFT JOIN customers c ON c.id=v.customer_id
     LEFT JOIN orders o ON o.id=v.order_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )
  return rows
}

export const listWithTotal = async ({ page = 1, pageSize = 20, q, status, salon_id, date_from, date_to }) => {
  const offset = (page - 1) * pageSize
  const { where, params } = buildWhere({ q, status, salon_id, date_from, date_to })

  const [rows] = await pool.query(
    `SELECT v.*, COALESCE(rs.name, s.name) AS salon_name,
            c.first_name AS customer_first_name,
            c.last_name AS customer_last_name,
            c.email AS customer_email,
            c.phone AS customer_phone,
            o.order_id AS order_number,
            o.external_id AS order_external_id,
            o.source AS order_source
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN redemptions r ON r.voucher_id=v.id AND r.is_deleted=0
     LEFT JOIN salons rs ON rs.id=r.salon_id
     LEFT JOIN customers c ON c.id=v.customer_id
     LEFT JOIN orders o ON o.id=v.order_id
     WHERE ${where.join(' AND ')}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM vouchers v
     LEFT JOIN redemptions r ON r.voucher_id=v.id AND r.is_deleted=0
     WHERE ${where.join(' AND ')}`,
    params
  )
  return { rows, total: countRows[0]?.total || 0 }
}

/** NEW: All non-redeemed vouchers for a specific salon */
export const listAvailableForSalon = async (salon_id, { page = 1, pageSize = 50 } = {}) => {
  const offset = (page - 1) * pageSize
  const [rows] = await pool.query(
    `SELECT v.*, s.name AS salon_name,
            o.order_id AS order_number,
            o.external_id AS order_external_id,
            o.source AS order_source
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN orders o ON o.id=v.order_id
     WHERE v.is_deleted=0
       AND v.status='AVAILABLE'
       AND (v.salon_id = ? OR v.salon_id IS NULL)
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [Number(salon_id), pageSize, offset]
  )
  return rows
}

/** NEW: Vouchers redeemed at a given salon (even if the voucher belongs elsewhere) */
export const listRedeemedAtSalon = async (salon_id, { page = 1, pageSize = 50 } = {}) => {
  const offset = (page - 1) * pageSize
  const [rows] = await pool.query(
    `SELECT v.*, s.name AS voucher_salon_name, r.redeemed_at,
            o.order_id AS order_number,
            o.external_id AS order_external_id,
            o.source AS order_source
     FROM redemptions r
     JOIN vouchers v ON v.id=r.voucher_id AND v.is_deleted=0
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN orders o ON o.id=v.order_id
     WHERE r.is_deleted=0 AND r.salon_id=?
     ORDER BY r.redeemed_at DESC
     LIMIT ? OFFSET ?`,
    [Number(salon_id), pageSize, offset]
  )
  return rows
}

export const update = async (id, payload, conn = null) => {
  const fields = ['title','face_value','currency','expires_at','status','notes','salon_id','customer_id','code','order_id','created_at']
  const sets = []
  const vals = []
  fields.forEach(f => {
    if (payload[f] !== undefined) { sets.push(`${f}=?`); vals.push(payload[f]) }
  })
  if (!sets.length) return
  vals.push(id)
  const db = conn || pool
  await db.query(`UPDATE vouchers SET ${sets.join(', ')} WHERE id=? AND is_deleted=0`, vals)
}

export const softDelete = async (id) => {
  await pool.query('UPDATE vouchers SET is_deleted=1, deleted_at=NOW() WHERE id=? AND is_deleted=0', [id])
}

export const listByOrderId = async (order_id, conn = null) => {
  if (!order_id) return []
  const db = conn || pool
  const [rows] = await db.query(
    `SELECT v.*
     FROM vouchers v
     WHERE v.order_id=? AND v.is_deleted=0
     ORDER BY v.id ASC`,
    [order_id]
  )
  return rows
}

export const voidAtSalon = async ({ voucher_id, salon_id, user_id, notes }) => {
  // Optional notes can be saved in vouchers.notes (append)
  if (notes) {
    await pool.query('UPDATE vouchers SET notes = CONCAT(IFNULL(notes,""), ?) WHERE id=? AND is_deleted=0', [`\n[VOID NOTE] ${notes}`, voucher_id])
  }
  await pool.query(
    `UPDATE vouchers
       SET status='VOID',
           voided_at = NOW(),
           voided_by_user_id = ?,
           voided_at_salon_id = ?
     WHERE id=? AND is_deleted=0 AND status <> 'VOID'`,
    [user_id, salon_id || null, voucher_id]
  )
}

// NEW: list of vouchers voided at a specific salon
export const listVoidedAtSalon = async (salon_id, { page = 1, pageSize = 50 } = {}) => {
  const offset = (page - 1) * pageSize
  const [rows] = await pool.query(
    `SELECT v.*, s.name AS voucher_salon_name,
            o.order_id AS order_number,
            o.external_id AS order_external_id,
            o.source AS order_source
     FROM vouchers v
     LEFT JOIN salons s ON s.id=v.salon_id
     LEFT JOIN orders o ON o.id=v.order_id
     WHERE v.is_deleted=0 AND v.status='VOID' AND v.voided_at_salon_id=?
     ORDER BY v.voided_at DESC
     LIMIT ? OFFSET ?`,
    [Number(salon_id), pageSize, offset]
  )
  return rows
}
