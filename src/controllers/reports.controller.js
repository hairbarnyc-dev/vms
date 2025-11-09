import { pool } from '../config/db.js'

/** Build WHERE for vouchers, optionally widening salon scope to include NULL (global) */
const buildWhere = (alias, { status, salon_id, date_from, date_to, includeGlobalForSalonId = null }) => {
  const where = [`${alias}.is_deleted=0`]
  const vals = []

  if (status) { where.push(`${alias}.status=?`); vals.push(status) }

  if (includeGlobalForSalonId != null) {
    // salon user: include their salon OR global
    where.push(`(${alias}.salon_id = ? OR ${alias}.salon_id IS NULL)`)
    vals.push(Number(includeGlobalForSalonId))
  } else if (salon_id) {
    // admin filter by specific salon
    where.push(`${alias}.salon_id=?`)
    vals.push(Number(salon_id))
  }

  if (date_from) { where.push(`${alias}.created_at>=?`); vals.push(new Date(date_from)) }
  if (date_to)   { where.push(`${alias}.created_at<?`);  vals.push(new Date(date_to)) }

  return { clause: 'WHERE ' + where.join(' AND '), vals }
}

export const dashboardStats = async (req, res, next) => {
  try {
    const { status = '', salon_id = '', date_from = '', date_to = '' } = req.query
    const isSalonUser = req.ctx.roleId === 3
    const mySalonId = isSalonUser ? (req.ctx.salonIds[0] || null) : null

    const filters = {
      status: status || null,
      salon_id: isSalonUser ? null : (salon_id || null),
      date_from: date_from || null,
      date_to: date_to ? (date_to + ' 23:59:59') : null,
      includeGlobalForSalonId: isSalonUser ? mySalonId : null
    }

    // metrics over vouchers (include global for salon users)
    const { clause, vals } = buildWhere('v', filters)
    const [totV] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(v.status='AVAILABLE') AS available,
         SUM(v.status='REDEEMED')  AS redeemed,
         SUM(v.status='VOID')      AS voided
       FROM vouchers v
       ${clause}`, vals
    )

    // salons list (admins only; salon user doesn't need it)
    let salons = []
    if (!isSalonUser) {
      ;[salons] = await pool.query('SELECT id, name FROM salons WHERE is_deleted=0 ORDER BY name ASC')
    }

    // recent redemptions: salon users see only at their salon
    let recentQuery = `
      SELECT r.id, r.redeemed_at, v.code, v.title, s.name AS salon_name
      FROM redemptions r
      JOIN vouchers v ON v.id=r.voucher_id
      LEFT JOIN salons s ON s.id=r.salon_id
      WHERE r.is_deleted=0
    `
    const recentVals = []
    if (isSalonUser && mySalonId) {
      recentQuery += ' AND r.salon_id = ?'
      recentVals.push(Number(mySalonId))
    }
    recentQuery += ' AND r.redeemed_at>=DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY r.redeemed_at DESC LIMIT 10'
    const [recent] = await pool.query(recentQuery, recentVals)

    res.render('dashboard', {
      user: req.user,
      isSalonUser,
      filters: {
        status,
        salon_id: salon_id || '',
        date_from,
        date_to: date_to?.slice(0, 10) || ''
      },
      salons,
      metrics: totV[0],
      recent
    })
  } catch (e) { next(e) }
}

export const vouchersCsv = async (req, res, next) => {
  try {
    const isSalonUser = req.ctx.roleId === 3
    const mySalonId = isSalonUser ? (req.ctx.salonIds[0] || null) : null

    const { status = '', salon_id = '', date_from = '', date_to = '' } = req.query
    const filters = {
      status: status || null,
      salon_id: isSalonUser ? null : (salon_id || null),
      date_from: date_from || null,
      date_to: date_to ? (date_to + ' 23:59:59') : null,
      includeGlobalForSalonId: isSalonUser ? mySalonId : null
    }

    const { clause, vals } = buildWhere('v', filters)
    const [rows] = await pool.query(
      `SELECT v.code, v.title, v.face_value, v.currency, v.status, v.created_at, s.name AS salon_name
       FROM vouchers v
       LEFT JOIN salons s ON s.id=v.salon_id
       ${clause}
       ORDER BY v.created_at DESC
       LIMIT 5000`, vals
    )

    const header = 'code,title,face_value,currency,status,created_at,salon_name'
    const csv = [header]
    for (const r of rows) {
      const vals2 = [
        r.code, r.title, r.face_value, r.currency, r.status,
        r.created_at?.toISOString?.() ?? r.created_at, r.salon_name || ''
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`)
      csv.push(vals2.join(','))
    }
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="vouchers.csv"')
    res.send(csv.join('\n'))
  } catch (e) { next(e) }
}
