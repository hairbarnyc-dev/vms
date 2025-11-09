import { comparePassword, hashPassword } from '../utils/crypto.js'
import { updatePasswordById, findByEmailAny } from '../models/usersModel.js'
import * as PR from '../models/passwordResetModel.js'
import { sendMail } from '../utils/mailer.js'

const genOtp = () => String(Math.floor(100000 + Math.random()*900000)) // 6 digits

// --- Change Password (logged-in) ---
export const getChangePassword = (req, res) => {
  res.render('account/change-password', { user: req.user, msg: '', err: '' })
}

export const postChangePassword = async (req, res) => {
  const { old_password, new_password, confirm_password } = req.body
  if (!old_password || !new_password || !confirm_password)
    return res.render('account/change-password', { user: req.user, err: 'All fields are required', msg: '' })

  if (new_password !== confirm_password)
    return res.render('account/change-password', { user: req.user, err: 'Passwords do not match', msg: '' })

  const ok = await comparePassword(old_password, req.ctx.userRow.password_hash)
  if (!ok) return res.render('account/change-password', { user: req.user, err: 'Old password is incorrect', msg: '' })

  // enforce strength: >=8, 1 lower, 1 upper, 1 special
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/
  if (!PASSWORD_REGEX.test(new_password))
    return res.render('account/change-password', { user: req.user, err: 'New password must be 8+ chars with upper, lower, special', msg: '' })

  const hash = await hashPassword(new_password)
  await updatePasswordById(req.user.id, hash)
  res.render('account/change-password', { user: req.user, err: '', msg: 'Password updated successfully' })
}

// --- Forgot Password (OTP) ---
export const getForgot = (_req, res) => {
  res.render('auth/forgot', { msg: '', err: '' })
}

export const postForgot = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  if (!email) return res.render('auth/forgot', { err: 'Email is required', msg: '' })

  const user = await findByEmailAny(email)
  // For security, behave the same even if not found
  const otp = genOtp()
  const expiresAt = new Date(Date.now() + 10*60*1000)    // 10 minutes
  const resendAfter = new Date(Date.now() + 2*60*1000)   // 2 minutes
  await PR.createOtp({ user_id: user?.id || null, email, otp_code: otp, expiresAt, resendAfter })

  // Send email
  await sendMail({
    to: email,
    subject: 'VMS Password Reset OTP',
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`
  })

  res.render('auth/verify-otp', {
    email,
    resendRemainingSec: 120,
    err: '',
    msg: 'We sent a 6-digit OTP to your email.'
  })
}

export const postResendOtp = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const latest = await PR.getLatestForEmail(email)
  if (!latest) {
    return res.render('auth/forgot', { err: 'Start over. Enter your email again.', msg: '' })
  }
  const now = new Date()
  const waitMs = new Date(latest.resend_after).getTime() - now.getTime()
  if (waitMs > 0) {
    return res.render('auth/verify-otp', {
      email, resendRemainingSec: Math.ceil(waitMs/1000),
      err: 'Please wait before requesting a new OTP.', msg: ''
    })
  }

  // issue a new OTP
  const otp = genOtp()
  const expiresAt = new Date(Date.now() + 10*60*1000)
  const resendAfter = new Date(Date.now() + 2*60*1000)
  await PR.createOtp({ user_id: latest.user_id, email, otp_code: otp, expiresAt, resendAfter })
  await sendMail({ to: email, subject: 'VMS Password Reset OTP', html: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>` })

  res.render('auth/verify-otp', {
    email, resendRemainingSec: 120, err: '', msg: 'A new OTP has been sent.'
  })
}

export const postVerifyOtp = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const code = String(req.body.otp || '').trim()
  if (!email || !code) {
    return res.render('auth/verify-otp', { email, resendRemainingSec: 0, err: 'Enter the OTP.', msg: '' })
  }
  const latest = await PR.getLatestForEmail(email)
  if (!latest || latest.used || latest.otp_code !== code || new Date(latest.otp_expires_at) < new Date()) {
    return res.render('auth/verify-otp', { email, resendRemainingSec: 0, err: 'Invalid or expired OTP.', msg: '' })
  }
  // Success → allow reset page
  res.render('auth/reset-password', { email, tokenId: latest.id, err: '', msg: '' })
}

export const postResetPassword = async (req, res) => {
  const { email, tokenId, new_password, confirm_password } = req.body
  const latest = await PR.getLatestForEmail(String(email || '').toLowerCase())
  if (!latest || String(latest.id) !== String(tokenId) || latest.used || new Date(latest.otp_expires_at) < new Date()) {
    return res.render('auth/forgot', { err: 'Invalid or expired reset session. Start over.', msg: '' })
  }
  if (!new_password || !confirm_password || new_password !== confirm_password) {
    return res.render('auth/reset-password', { email, tokenId, err: 'Passwords do not match', msg: '' })
  }
  const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/
  if (!PASSWORD_REGEX.test(new_password)) {
    return res.render('auth/reset-password', { email, tokenId, err: 'Password must be 8+ chars with upper, lower, special', msg: '' })
  }

  const user = await findByEmailAny(email)
  if (!user) {
    // Pretend success for security
    await PR.markUsed(latest.id)
    return res.render('auth/forgot', { err: '', msg: 'Password reset complete. You can log in now.' })
  }

  const hash = await hashPassword(new_password)
  await updatePasswordById(user.id, hash)
  await PR.markUsed(latest.id)
  res.render('auth/forgot', { err: '', msg: 'Password reset complete. You can log in now.' })
}
