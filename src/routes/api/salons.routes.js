import { Router } from 'express'
import * as C from '../../controllers/salons.controller.js'
import { requireAuth } from '../../middleware/auth.js'
const r = Router()

r.get('/', requireAuth([1,2]), C.list)
r.post('/', requireAuth([1]), C.create)
r.get('/:id', requireAuth([1,2]), C.get)
r.put('/:id', requireAuth([1,2]), C.update)
r.delete('/:id', requireAuth([1]), C.softDelete)  // soft delete

export default r
