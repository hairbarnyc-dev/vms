import { findByEmail } from '../models/usersModel.js'
import { comparePassword, signJwt } from '../utils/crypto.js'
import { logAction } from '../utils/audit.js'

/**
 * API login (returns JSON {token})
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await findByEmail(email)
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const ok = await comparePassword(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = signJwt({ id: user.id, role: user.role_id, email: user.email })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    await logAction(req, { action: 'LOGIN', entity_type: 'user', entity_id: user.id })
    res.json({ token })
  } catch (e) { next(e) }
}

/**
 * Web login (redirects to /dashboard on success)
 */
export const webLogin = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim()
    const password = String(req.body.password || '')

    const user = await findByEmail(email)
    if (!user || !user.is_active) return res.redirect('/login?error=1')

    const ok = await comparePassword(password, user.password_hash)
    if (!ok) return res.redirect('/login?error=1')

    const token = signJwt({ id: user.id, role: user.role_id, email: user.email })
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax' })
    await logAction(req, { action: 'LOGIN', entity_type: 'user', entity_id: user.id })

    return res.redirect('/dashboard')
  } catch (e) { next(e) }
}
