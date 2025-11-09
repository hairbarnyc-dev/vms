import { Router } from 'express'
import * as C from '../../controllers/campaigns.controller.js'
import { requireAuth } from '../../middleware/auth.js'
const r = Router()

r.get('/', requireAuth([1,2]), C.list)
r.post('/', requireAuth([1,2]), C.create)
r.put('/:id', requireAuth([1,2]), C.update)
r.delete('/:id', requireAuth([1,2]), C.softDelete)  // soft delete

export default r
