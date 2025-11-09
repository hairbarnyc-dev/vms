import { Router } from 'express'
import { requireAuthWeb } from '../../middleware/auth.js'
import {
  getChangePassword, postChangePassword,
  getForgot, postForgot, postResendOtp, postVerifyOtp, postResetPassword
} from '../../controllers/account.controller.js'

const r = Router()

// Change password (must be logged in)
r.get('/account/password', requireAuthWeb([1,2,3]), getChangePassword)
r.post('/account/password', requireAuthWeb([1,2,3]), postChangePassword)

// Forgot password (public)
r.get('/forgot', getForgot)
r.post('/forgot', postForgot)
r.post('/forgot/resend', postResendOtp)
r.post('/forgot/verify', postVerifyOtp)
r.post('/forgot/reset', postResetPassword)

export default r
