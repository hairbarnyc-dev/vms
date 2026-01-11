import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import * as V from '../../controllers/vouchers.controller.js'

const r = Router()
r.post('/', requireAuth([1, 2]), V.create)
r.post('/sync', requireAuth([1, 2]), V.syncFromWp)
r.get('/', requireAuth([1, 2]), V.list)
r.get('/code/:code', requireAuth([1, 2, 3]), V.detail)
r.put('/:id', requireAuth([1, 2]), V.update)
r.delete('/:id', requireAuth([1]), V.softDelete) // soft delete
r.post('/:code/redeem', requireAuth([2, 3]), V.redeem)
export default r
