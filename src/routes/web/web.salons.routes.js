import { Router } from 'express'
import { requireAuthWeb } from '../../middleware/auth.js'
import * as Salons from '../../models/salonsModel.js'
import {
  findByEmail, createUser, mapUserToSalon, grantPermissions,
  getSalonAdminUser, updateUserEmailAndPassword
} from '../../models/usersModel.js'
import { hashPassword } from '../../utils/crypto.js'

const r = Router()
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/

// Helper: ensure email is truly free for both salon + user (or belongs to THIS salon)
async function assertEmailAvailableOrSame(email, salonId = null) {
  // Users: must be unique unless it's the same admin user of this salon
  const existingUser = await findByEmail(email)
  if (existingUser && salonId) {
    // Is that user already the admin of this salon?
    const admin = await getSalonAdminUser(salonId)
    if (!admin || admin.id !== existingUser.id) {
      throw new Error('That email is already used by another user')
    }
  } else if (existingUser && !salonId) {
    throw new Error('That email is already used by another user')
  }

  // Salons: must be unique unless it's this salon
  const salons = await Salons.list()
  const conflict = salons.find(s => s.email && s.email.toLowerCase() === email.toLowerCase() && (salonId ? s.id !== Number(salonId) : true))
  if (conflict) throw new Error('That email is already used by another salon')
}

r.get('/', requireAuthWeb([1,2]), async (_req, res, next) => {
  try { res.render('salons/index', { rows: await Salons.list() }) } catch (e) { next(e) }
})

r.get('/create', requireAuthWeb([1]), (_req, res) =>
  res.render('salons/form', { mode: 'create', row: {}, showUserFields: true, adminUser: null })
)

r.post('/create', requireAuthWeb([1]), async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim()
    const pw = String(req.body.password || '')
    const cpw = String(req.body.confirm_password || '')

    if (!email || !pw || !cpw) return res.status(400).send('Email and passwords are required')
    if (pw !== cpw) return res.status(400).send('Passwords do not match')
    if (!PASSWORD_REGEX.test(pw)) return res.status(400).send('Password must be 8+ chars with upper, lower, and special')

    // Ensure email is unique globally (no other salon or user)
    await assertEmailAvailableOrSame(email, null)

    // 1) Create salon with that email
    const salon_id = await Salons.create({ ...req.body, email })

    // 2) Create Salon Admin user (role 3) with same email
    const password_hash = await hashPassword(pw)
    const user_id = await createUser({
      email,
      password_hash,
      first_name: req.body.contact_first_name || 'Salon',
      last_name: req.body.contact_last_name || 'Admin',
      role_id: 3
    })

    // 3) Map and grant perms (unique user_id mapping enforced by DB)
    await mapUserToSalon({ user_id, salon_id, role_in_salon: 'ADMIN' })
    await grantPermissions(user_id, [
        'SALON_VOUCHER_VIEW',
        'SALON_VOUCHER_REDEEM',
        'SALON_VOUCHER_VOID'
    ])


    return res.redirect('/salons')
  } catch (e) {
    if (String(e.message || '').includes('email')) return res.status(400).send(e.message)
    next(e)
  }
})

r.get('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const row = await Salons.get(req.params.id)
    if (!row) return res.redirect('/salons')
    const adminUser = await getSalonAdminUser(row.id)
    res.render('salons/form', { mode: 'edit', row, showUserFields: true, adminUser })
  } catch (e) { next(e) }
})

r.post('/:id/edit', requireAuthWeb([1,2]), async (req, res, next) => {
  try {
    const salonId = Number(req.params.id)
    const email = String(req.body.email || '').trim()
    const pw = String(req.body.password || '').trim()
    const cpw = String(req.body.confirm_password || '').trim()

    // Ensure email is globally unique or belongs to this salon’s admin
    await assertEmailAvailableOrSame(email, salonId)

    // Update salon’s email (and other fields)
    await Salons.update(salonId, { ...req.body, email })

    // Update linked admin user email (and password if provided)
    const adminUser = await getSalonAdminUser(salonId)
    if (adminUser) {
      const updates = {}
      if (email && email !== adminUser.email) updates.email = email
      if (pw || cpw) {
        if (pw !== cpw) return res.status(400).send('Passwords do not match')
        if (!PASSWORD_REGEX.test(pw)) return res.status(400).send('Password must be 8+ chars with upper, lower, and special')
        updates.password_hash = await hashPassword(pw)
      }
      if (Object.keys(updates).length) {
        await updateUserEmailAndPassword(adminUser.id, updates)
      }
    }
    return res.redirect('/salons')
  } catch (e) {
    if (String(e.message || '').includes('email')) return res.status(400).send(e.message)
    next(e)
  }
})

r.post('/:id/delete', requireAuthWeb([1]), async (req, res, next) => {
  try { await Salons.softDelete(req.params.id); res.redirect('/salons') } catch (e) { next(e) }
})

export default r
