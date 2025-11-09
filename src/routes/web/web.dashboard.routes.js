import { Router } from 'express'
import { requireAuthWeb } from '../../middleware/auth.js'
import { dashboardStats } from '../../controllers/reports.controller.js'

const r = Router()
r.get('/', requireAuthWeb([1,2,3]), dashboardStats)
export default r
