import { Router } from 'express'
import { vouchersCsv } from '../../controllers/reports.controller.js'
import { requireAuth } from '../../middleware/auth.js'
const r = Router()

r.get('/vouchers.csv', requireAuth([1,2]), vouchersCsv)

export default r
