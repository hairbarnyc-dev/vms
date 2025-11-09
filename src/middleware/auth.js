import { verifyJwt } from '../utils/crypto.js'
import { pool } from '../config/db.js'
import { getBasicById } from '../models/usersModel.js'

export async function loadContext(userId, roleId) {
  // 1) Salons mapped to this user
  const [salonRows] = await pool.query(
    'SELECT salon_id FROM salon_users WHERE user_id=? AND is_deleted=0',
    [userId]
  )
  const salonIds = salonRows.map(r => Number(r.salon_id)).filter(Boolean)

  // 2) Explicit permissions
  const [permRows] = await pool.query(
    'SELECT perm_code FROM user_permissions WHERE user_id=?',
    [userId]
  )
  const perms = new Set(permRows.map(r => r.perm_code))

  // 3) Full user row (for old-password compare, etc.)
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE id=? AND is_deleted=0 LIMIT 1',
    [userId]
  )
  const userRow = rows[0] || null

  // 4) Build the context object
  const ctx = {
    roleId: Number(roleId) || 0,
    salonIds,
    perms,
    userRow,
    // convenience fields (handy across views/controllers)
    mySalonId: salonIds[0] || null,
    isSalonUser: Number(roleId) === 3,
    isAdmin: Number(roleId) === 2 || Number(roleId) === 1,
  }

  return ctx
}

export const requireAuth = (roles = []) => {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization
      const token = req.cookies?.token || (header && header.startsWith('Bearer ') ? header.slice(7) : null)
      if (!token) return res.status(401).json({ error: 'Unauthorized' })
      const user = verifyJwt(token)
      req.user = user
      if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' })
      req.ctx = await loadContext(user.id, user.role)
      const profile = await getBasicById(user.id)
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()

      res.locals.user = req.user                      // existing
      res.locals.isSalonUser = (req.ctx?.roleId === 3) // existing
      res.locals.userProfile = profile                // NEW
      res.locals.userDisplayName = fullName || profile?.email || 'User'
      res.locals.userEmail = profile?.email || ''
      next()
    } catch {
      res.status(401).json({ error: 'Invalid token' })
    }
  }
}

export const requireAuthWeb = (roles = []) => {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization
      const token = req.cookies?.token || (header && header.startsWith('Bearer ') ? header.slice(7) : null)
      if (!token) return res.redirect('/login')

      const user = verifyJwt(token)
      req.user = user

      if (roles.length && !roles.includes(user.role)) return res.redirect('/login')

      req.ctx = await loadContext(user.id, user.role)

      // 👇 Fill view locals for all EJS pages behind this middleware
      const profile = await getBasicById(user.id)
      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()

      res.locals.user = req.user
      res.locals.isSalonUser = (req.ctx?.roleId === 3)
      res.locals.userProfile = profile
      res.locals.userDisplayName = fullName || profile?.email || 'User'
      res.locals.userEmail = profile?.email || ''

      next()
    } catch {
      return res.redirect('/login')
    }
  }
}


/** Permission check utility (works for API & Web) */
export const requirePerm = (permCode) => {
  return (req, res, next) => {
    if (!req.ctx?.perms?.has(permCode)) {
      // Web: redirect, API: JSON
      if (req.accepts(['html', 'json']) === 'html') return res.redirect('/dashboard')
      return res.status(403).json({ error: 'Insufficient permission' })
    }
    next()
  }
}
