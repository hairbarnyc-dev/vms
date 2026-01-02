import crypto from 'crypto'
import * as Vouchers from '../models/vouchersModel.js'
import * as Orders from '../models/ordersModel.js'
import { pool } from '../config/db.js'
import { redeem as redeemModel } from '../models/redemptionsModel.js'
import { logAction } from '../utils/audit.js'

const genCode = () => crypto.randomBytes(6).toString('base64url').toUpperCase() // ~8 chars

const normalizeProducts = (list) => {
  if (!list) return []
  const arr = Array.isArray(list) ? list : Object.values(list)
  return arr
    .map((item) => ({
      product_id: typeof item?.product_id === 'string' || typeof item?.product_id === 'number' ? String(item.product_id) : null,
      product_name: item?.product_name || item?.name || '',
      product_price: Number(item?.product_price ?? item?.price ?? 0) || 0,
    }))
    .filter((p) => p.product_name || p.product_id)
}

const ensureCustomer = async (conn, customer) => {
  if (!customer || (!customer.email && !customer.phone)) return null
  const [exist] = await conn.query(
    'SELECT id FROM customers WHERE email <=> ? AND phone <=> ? AND is_deleted=0 LIMIT 1',
    [customer.email || null, customer.phone || null]
  )
  if (exist[0]) return exist[0].id
  const [ins] = await conn.query(
    'INSERT INTO customers (email, phone, first_name, last_name) VALUES (?,?,?,?)',
    [customer.email || null, customer.phone || null, customer.first_name || null, customer.last_name || null]
  )
  return ins.insertId
}

const normalizeOrderPayload = (body = {}) => {
  const order = body.order || {}
  const rawExternal =
    order.external_id ||
    body.order_external_id ||
    order.order_id ||
    body.order_id ||
    body.order_number ||
    null
  const rawOrderId =
    order.order_id ||
    body.order_id ||
    body.order_number ||
    body.order_external_id ||
    null
  const source = order.source || body.order_source || body.source || 'custom'
  const currency = order.currency || body.currency || 'CAD'
  const faceValue = Number(body.face_value ?? order.face_value ?? order.order_total ?? body.order_total ?? body.amount ?? 0) || 0
  const orderTotal = body.order_total ?? order.order_total ?? faceValue
  const products = normalizeProducts(body.order_products || order.products)
  const title = body.title || order.title || (rawOrderId ? `Order ${rawOrderId}` : 'Voucher')
  const externalFallback = rawExternal || rawOrderId || `manual-${Date.now()}`
  return {
    external_id: externalFallback,
    order_id: rawOrderId,
    source,
    currency,
    face_value: faceValue || orderTotal || 0,
    order_total: Number(orderTotal ?? faceValue ?? 0) || 0,
    title,
    products,
  }
}

export const createVoucherRecord = async (payload, req = null) => {
  const conn = await pool.getConnection()
  try {
    const customer_id = await ensureCustomer(conn, payload.customer)
    const orderData = normalizeOrderPayload(payload)
    const order_id = await Orders.upsertOrder(
      {
        external_id: orderData.external_id,
        order_id: orderData.order_id,
        source: orderData.source,
        customer_id,
        amount: orderData.face_value,
        order_total: orderData.order_total,
        currency: orderData.currency,
        status: 'COMPLETED',
      },
      conn
    )
    await Orders.replaceOrderProducts(order_id, orderData.products, conn)
    const now = new Date()
    const defaultExpiry = new Date(
      now.getFullYear() + 1,
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    )
    const expiresAt = payload.expires_at ? new Date(payload.expires_at) : defaultExpiry
    const code = (payload.code || '').trim() || genCode()
    const vid = await Vouchers.createVoucher(
      {
        code,
        salon_id: payload.salon_id || null,
        order_id,
        customer_id,
        title: orderData.title,
        face_value: orderData.face_value,
        currency: orderData.currency,
        expires_at: expiresAt,
      },
      conn
    )
    if (req) {
      await logAction(req, {
        action: 'VOUCHER_CREATE',
        entity_type: 'voucher',
        entity_id: vid,
        payload: { code, title: orderData.title, order_id },
      })
    }
    return { voucherId: vid, code }
  } catch (err) {
    throw err
  } finally {
    conn.release()
  }
}

export const create = async (req, res, next) => {
  try {
    const result = await createVoucherRecord(req.body, req)
    res.status(201).json({ id: result.voucherId, code: result.code })
  } catch (e) {
    next(e)
  }
}

export const list = async (req, res, next) => {
  try {
    const { page, pageSize, q, status, salon_id, date_from, date_to } = req.query
    const rows = await Vouchers.list({
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
      q: q || null,
      status: status || null,
      salon_id: salon_id || null,
      date_from: date_from || null,
      date_to: date_to || null
    })
    res.json(rows)
  } catch (e) { next(e) }
}

export const detail = async (req, res, next) => {
  try {
    const { code } = req.params
    const v = await Vouchers.getByCode(code)
    if (!v) return res.status(404).json({ error: 'Not found' })
    const order = v.order_id ? await Orders.getOrderWithProducts(v.order_id) : null
    await logAction(req, { action: 'VOUCHER_VIEW', entity_type: 'voucher', entity_id: v.id })
    res.json({ ...v, order })
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
      const selectedSalonId = Number(req.body.salon_id || v.salon_id || 0) || null
      if (!selectedSalonId) return res.status(400).json({ error: 'Missing salon' })
      await redeemModel({
        voucher_id: v.id,
        salon_id: selectedSalonId,
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
