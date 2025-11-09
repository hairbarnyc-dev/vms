import { Router } from 'express'
import { requireAuthWeb } from '../../middleware/auth.js'
import * as Vouchers from '../../models/vouchersModel.js'
import * as Salons from '../../models/salonsModel.js'
import crypto from 'crypto'

const r = Router()

// Landing
r.get('/', requireAuthWeb([1,2,3]), async (req, res, next) => {
  try {
    const isSalonUser = req.ctx.roleId === 3
    if (isSalonUser) {
      const mySalonId = req.ctx.salonIds[0]
      const rows = await Vouchers.listAvailableForSalon(mySalonId, { page: 1, pageSize: 50 })
      return res.render('vouchers/index', {
        user: req.user,                  // <— add this
        rows,
        viewTitle: 'Available (Your Salon)',
        isSalonUser: true,
        activeTab: 'available'
      })
    }
    const rows = await Vouchers.list({ page: 1, pageSize: 25 })
    return res.render('vouchers/index', {
      user: req.user,                  // <— add this
      rows,
      viewTitle: 'Vouchers',
      isSalonUser: false,
      activeTab: ''
    })
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
  try { res.render('vouchers/form', { user: req.user, mode: 'create', row: {}, salons: await Salons.list() }) }
  catch (e) { next(e) }
})

r.post('/create', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const code = req.body.code?.trim() || crypto.randomBytes(6).toString('base64url').toUpperCase()
    await Vouchers.createVoucher({
      code, salon_id: req.body.salon_id || null, order_id: null, customer_id: null,
      title: req.body.title, face_value: req.body.face_value || 0,
      currency: req.body.currency || 'CAD', expires_at: req.body.expires_at || null
    })
    res.redirect('/vouchers/manage')
  } catch (e) { next(e) }
})

r.get('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const row = await Vouchers.getById(req.params.id)
    if (!row) return res.redirect('/vouchers/manage')
    res.render('vouchers/form', { user: req.user, mode: 'edit', row, salons: await Salons.list() })
  } catch (e) { next(e) }
})

r.post('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    await Vouchers.update(req.params.id, {
      code: req.body.code, title: req.body.title, face_value: req.body.face_value,
      currency: req.body.currency, expires_at: req.body.expires_at || null,
      status: req.body.status, notes: req.body.notes, salon_id: req.body.salon_id || null
    })
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
