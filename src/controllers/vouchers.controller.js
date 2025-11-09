import crypto from 'crypto'
import * as Vouchers from '../models/vouchersModel.js'
import { pool } from '../config/db.js'
import { redeem as redeemModel } from '../models/redemptionsModel.js'
import { logAction } from '../utils/audit.js'

const genCode = () => crypto.randomBytes(6).toString('base64url').toUpperCase() // ~8 chars

export const create = async (req, res, next) => {
  try {
    const { salon_id, order_external_id, source, title, face_value, currency, customer } = req.body
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      let customer_id = null
      if (customer?.email || customer?.phone) {
        const [exist] = await conn.query(
          'SELECT id FROM customers WHERE email <=> ? AND phone <=> ? AND is_deleted=0 LIMIT 1',
          [customer.email || null, customer.phone || null]
        )
        if (exist[0]) customer_id = exist[0].id
        else {
          const [ins] = await conn.query(
            'INSERT INTO customers (email, phone, first_name, last_name) VALUES (?,?,?,?)',
            [customer.email || null, customer.phone || null, customer.first_name || null, customer.last_name || null]
          )
          customer_id = ins.insertId
        }
      }
      await conn.query(
        `INSERT INTO orders (external_id, source, customer_id, amount, currency, status)
         VALUES (?,?,?,?,?, 'COMPLETED')
         ON DUPLICATE KEY UPDATE customer_id=VALUES(customer_id)`,
        [order_external_id, source || 'custom', customer_id, face_value || 0, currency || 'CAD']
      )
      const [ord] = await conn.query(
        'SELECT id FROM orders WHERE source=? AND external_id=? AND is_deleted=0',
        [source || 'custom', order_external_id]
      )
      const order_id = ord[0].id

      const code = genCode()
      const vid = await Vouchers.createVoucher({
        code, salon_id: salon_id || null, order_id, customer_id, title,
        face_value: face_value || 0, currency: currency || 'CAD', expires_at: null
      })
      await conn.commit()
      await logAction(req, { action: 'VOUCHER_CREATE', entity_type: 'voucher', entity_id: vid, payload: { code, title } })
      res.status(201).json({ id: vid, code })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (e) { next(e) }
}

export const list = async (req, res, next) => {
  try {
    const { page, pageSize, q } = req.query
    const rows = await Vouchers.list({ page: Number(page) || 1, pageSize: Number(pageSize) || 20, q })
    res.json(rows)
  } catch (e) { next(e) }
}

export const detail = async (req, res, next) => {
  try {
    const { code } = req.params
    const v = await Vouchers.getByCode(code)
    if (!v) return res.status(404).json({ error: 'Not found' })
    await logAction(req, { action: 'VOUCHER_VIEW', entity_type: 'voucher', entity_id: v.id })
    res.json(v)
  } catch (e) { next(e) }
}

export const update = async (req, res, next) => {
  try {
    await Vouchers.update(req.params.id, req.body)
    await logAction(req, { action: 'VOUCHER_UPDATE', entity_type: 'voucher', entity_id: Number(req.params.id), payload: req.body })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export const softDelete = async (req, res, next) => {
  try {
    await Vouchers.softDelete(req.params.id)
    await logAction(req, { action: 'VOUCHER_DELETE', entity_type: 'voucher', entity_id: Number(req.params.id) })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export const redeem = async (req, res, next) => {
  try {
    const { code } = req.params
    const { notes } = req.body
    const v = await Vouchers.getByCode(code)
    if (!v || v.status !== 'AVAILABLE' || v.is_deleted) {
      return res.status(400).json({ error: 'Invalid voucher' })
    }

    if (req.ctx.roleId === 3) {
      const mySalonId = req.ctx.salonIds[0]
      if (!mySalonId) return res.status(403).json({ error: 'No salon scope' })
      const visible = (v.salon_id == null) || (Number(v.salon_id) === Number(mySalonId))
      if (!visible) return res.status(403).json({ error: 'Voucher not visible to your salon' })
      if (!req.ctx.perms.has('SALON_VOUCHER_REDEEM')) return res.status(403).json({ error: 'Insufficient permission' })

      await redeemModel({
        voucher_id: v.id,
        salon_id: mySalonId,
        staff_user_id: req.user.id,
        notes
      })
    } else {
      await redeemModel({
        voucher_id: v.id,
        salon_id: v.salon_id || null,
        staff_user_id: req.user.id,
        notes
      })
    }

    await logAction(req, { action: 'VOUCHER_REDEEM', entity_type: 'voucher', entity_id: v.id, payload: { notes } })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// VOID
export const voidVoucher = async (req, res, next) => {
  try {
    const { code } = req.params
    const { notes } = req.body
    const v = await Vouchers.getByCode(code)
    if (!v || v.is_deleted) return res.status(400).json({ error: 'Invalid voucher' })
    if (v.status === 'VOID') return res.status(200).json({ ok: true }) // already void

    if (req.ctx.roleId === 3) {
      const mySalonId = req.ctx.salonIds[0]
      if (!mySalonId) return res.status(403).json({ error: 'No salon scope' })
      const visible = (v.salon_id == null) || (Number(v.salon_id) === Number(mySalonId))
      if (!visible) return res.status(403).json({ error: 'Voucher not visible to your salon' })
      if (!req.ctx.perms.has('SALON_VOUCHER_VOID')) return res.status(403).json({ error: 'Insufficient permission' })

      await Vouchers.voidAtSalon({ voucher_id: v.id, salon_id: mySalonId, user_id: req.user.id, notes })
    } else {
      // Admin can void; record where it was voided (use voucher's salon or null)
      await Vouchers.voidAtSalon({ voucher_id: v.id, salon_id: v.salon_id || null, user_id: req.user.id, notes })
    }

    await logAction(req, { action: 'VOUCHER_VOID', entity_type: 'voucher', entity_id: v.id, payload: { notes } })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

