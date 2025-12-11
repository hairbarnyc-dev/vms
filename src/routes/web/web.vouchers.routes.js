import { Router } from 'express'
import { requireAuthWeb } from '../../middleware/auth.js'
import * as Vouchers from '../../models/vouchersModel.js'
import * as Salons from '../../models/salonsModel.js'
import * as Orders from '../../models/ordersModel.js'
import { pool } from '../../config/db.js'
import crypto from 'crypto'
import { createVoucherRecord } from '../../controllers/vouchers.controller.js'

const r = Router()

const parseProductForm = (body = {}) => {
  const names = body.product_name || body['product_name[]'] || []
  const ids = body.product_id || body['product_id[]'] || []
  const prices = body.product_price || body['product_price[]'] || []
  const norm = (val) => (Array.isArray(val) ? val : val !== undefined ? [val] : [])
  const n = norm(names)
  const i = norm(ids)
  const p = norm(prices)
  const len = Math.max(n.length, i.length, p.length)
  const items = []
  for (let idx = 0; idx < len; idx++) {
    const name = (n[idx] ?? '').trim()
    const pid = (i[idx] ?? '').trim()
    const price = Number(p[idx] ?? 0) || 0
    if (!name && !pid) continue
    items.push({ product_name: name, product_id: pid || null, product_price: price })
  }
  return items
}

const orderPayloadFromForm = (body = {}) => {
  const orderRef = (body.order_external_id || body.order_number || body.order_id || '').trim()
  const rawTotal = body.order_total
  const order_total = rawTotal !== undefined && rawTotal !== '' ? Number(rawTotal) : null
  const order_source = (body.order_source || body.source || '').trim()
  return {
    order_external_id: orderRef,
    order_number: orderRef,
    order_total,
    order_source,
    products: parseProductForm(body),
  }
}

// Landing
r.get('/', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    if (req.ctx.roleId === 3) {
      const mySalonId = req.ctx.salonIds[0]
      const rows = await Vouchers.listAvailableForSalon(mySalonId, { page: 1, pageSize: 50 })
      return res.render('vouchers/index', {
        user: req.user,
        rows,
        viewTitle: 'Available (Your Salon)',
        isSalonUser: true,
        activeTab: 'available'
      })
    }
    return res.redirect('/vouchers/manage')
  } catch (e) { next(e) }
})

// Redeemed at this salon
r.get('/redeemed', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    if (req.ctx.roleId !== 3) return res.redirect('/vouchers/manage')
    const mySalonId = req.ctx.salonIds[0]
    const rows = await Vouchers.listRedeemedAtSalon(mySalonId, { page: 1, pageSize: 50 })
    res.render('vouchers/index', {
      user: req.user,                  // <— add this
      rows,
      viewTitle: 'Redeemed at Your Salon',
      isSalonUser: true,
      activeTab: 'redeemed'
    })
  } catch (e) { next(e) }
})

// NEW: Voided at this salon
r.get('/voided', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    if (req.ctx.roleId !== 3) return res.redirect('/vouchers/manage')
    const mySalonId = req.ctx.salonIds[0]
    const rows = await Vouchers.listVoidedAtSalon(mySalonId, { page: 1, pageSize: 50 })
    res.render('vouchers/index', {
      user: req.user,                  // <— add this
      rows,
      viewTitle: 'Voided at Your Salon',
      isSalonUser: true,
      activeTab: 'voided'
    })
  } catch (e) { next(e) }
})

// Admin management
r.get('/manage', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const { q = '', status = '', salon_id = '', date_from = '', date_to = '' } = req.query
    const rows = await Vouchers.list({ page: 1, pageSize: 50, q: q || null, status: status || null,
      salon_id: salon_id || null, date_from: date_from || null, date_to: date_to ? (date_to + ' 23:59:59') : null })
    const salons = await Salons.list()
    res.render('vouchers/manage', {
      user: req.user,                  // <— add this
      rows, salons, filters: { q, status, salon_id, date_from, date_to }
    })
  } catch (e) { next(e) }
})

// Admin create/edit/delete same as before
r.get('/create', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    res.render('vouchers/form', {
      user: req.user,
      mode: 'create',
      row: {},
      order: null,
      salons: await Salons.list(),
    })
  } catch (e) { next(e) }
})

r.post('/create', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const code = req.body.code?.trim() || crypto.randomBytes(6).toString('base64url').toUpperCase()
    const orderForm = orderPayloadFromForm(req.body)
    const resolvedOrderTotal = Number(orderForm.order_total ?? req.body.face_value ?? 0) || 0
    const resolvedFaceValue = Number(req.body.face_value || resolvedOrderTotal || 0) || 0
    await createVoucherRecord({
      code,
      salon_id: req.body.salon_id || null,
      title: req.body.title,
      source: orderForm.order_source || req.body.source,
      face_value: resolvedFaceValue,
      currency: req.body.currency || 'CAD',
      expires_at: req.body.expires_at || null,
      order_external_id: orderForm.order_external_id || `manual-${code}`,
      order_id: orderForm.order_number || orderForm.order_external_id || null,
      order_total: resolvedOrderTotal,
      order_products: orderForm.products,
    }, req)
    res.redirect('/vouchers/manage')
  } catch (e) { next(e) }
})

r.get('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const row = await Vouchers.getById(req.params.id)
    if (!row) return res.redirect('/vouchers/manage')
    const order = row.order_id ? await Orders.getOrderWithProducts(row.order_id) : null
    res.render('vouchers/form', { user: req.user, mode: 'edit', row, order, salons: await Salons.list() })
  } catch (e) { next(e) }
})

r.post('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const row = await Vouchers.getById(req.params.id)
    if (!row) return res.redirect('/vouchers/manage')
    const currentOrder = row.order_id ? await Orders.getOrderWithProducts(row.order_id) : null
    const orderForm = orderPayloadFromForm(req.body)
    const prevOrderTotal = currentOrder ? Number(currentOrder.order_total ?? currentOrder.amount ?? row.face_value ?? 0) : Number(row.face_value ?? 0) || 0
    const resolvedOrderTotal = Number(orderForm.order_total ?? prevOrderTotal) || 0
    const resolvedFaceValue = Number(req.body.face_value || resolvedOrderTotal || 0) || 0
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await Vouchers.update(req.params.id, {
        code: req.body.code,
        title: req.body.title,
        face_value: resolvedFaceValue,
        currency: req.body.currency,
        expires_at: req.body.expires_at || null,
        status: req.body.status,
        notes: req.body.notes,
        salon_id: req.body.salon_id || null,
      }, conn)
      let orderId = row.order_id
      const shouldAttachOrder = orderForm.order_external_id || orderForm.order_number || orderForm.order_total || orderForm.products.length
      if (!orderId && shouldAttachOrder) {
        orderId = await Orders.upsertOrder({
          external_id: orderForm.order_external_id || `manual-${row.code}`,
          order_id: orderForm.order_number || orderForm.order_external_id || null,
          source: orderForm.order_source || 'manual',
          amount: resolvedFaceValue,
          order_total: resolvedOrderTotal,
          currency: req.body.currency || 'CAD',
          status: 'COMPLETED',
        }, conn)
        await Vouchers.update(req.params.id, { order_id: orderId }, conn)
      }
      if (orderId) {
        await Orders.updateOrderById(orderId, {
          external_id: orderForm.order_external_id || currentOrder?.external_id || row.code,
          order_id: orderForm.order_number || orderForm.order_external_id || null,
          source: orderForm.order_source || currentOrder?.source || 'manual',
          amount: resolvedFaceValue,
          order_total: resolvedOrderTotal,
          currency: req.body.currency || 'CAD',
        }, conn)
        await Orders.replaceOrderProducts(orderId, orderForm.products, conn)
      }
      await conn.commit()
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
    res.redirect('/vouchers/manage')
  } catch (e) { next(e) }
})
r.post('/:id/delete', requireAuthWeb([1]), async (req, res, next) => {
  try { await Vouchers.softDelete(req.params.id); res.redirect('/vouchers/manage') }
  catch (e) { next(e) }
})

// --- Salon actions (simple web posts) ---

// Redeem by code (salon-safe): expects { code, notes? }
r.post('/action/redeem', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim()
    if (!code) return res.redirect('/vouchers')
    // reuse the API controller logic by calling your API route or duplicating logic here;
    // simplest: call the same redeem handler via fetch is not available here; so do a tiny inline:
    req.params = { code }
    req.body.notes = req.body.notes || ''
    const { redeem } = await import('../../controllers/vouchers.controller.js')
    // Call the controller but intercept JSON to redirect after success:
    const json = res.json
    res.json = (payload) => { if (payload?.ok) return res.redirect('/vouchers/redeemed'); return json.call(res, payload) }
    await redeem(req, res, next)
  } catch (e) { next(e) }
})

// Void by code (salon-safe): expects { code, notes? }
r.post('/action/void', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim()
    if (!code) return res.redirect('/vouchers')
    req.params = { code }
    req.body.notes = req.body.notes || ''
    const { voidVoucher } = await import('../../controllers/vouchers.controller.js')
    const json = res.json
    res.json = (payload) => { if (payload?.ok) return res.redirect('/vouchers/voided'); return json.call(res, payload) }
    await voidVoucher(req, res, next)
  } catch (e) { next(e) }
})

export default r
