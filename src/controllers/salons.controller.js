import * as Salons from '../models/salonsModel.js'
import { logAction } from '../utils/audit.js'

export const create = async (req, res, next) => {
  try {
    const id = await Salons.create(req.body)
    await logAction(req, { action: 'SALON_CREATE', entity_type: 'salon', entity_id: id, payload: req.body })
    res.status(201).json({ id })
  } catch (e) { next(e) }
}

export const list = async (_req, res, next) => {
  try {
    const rows = await Salons.list()
    res.json(rows)
  } catch (e) { next(e) }
}

export const get = async (req, res, next) => {
  try {
    const row = await Salons.get(req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  } catch (e) { next(e) }
}

export const update = async (req, res, next) => {
  try {
    await Salons.update(req.params.id, req.body)
    await logAction(req, { action: 'SALON_UPDATE', entity_type: 'salon', entity_id: Number(req.params.id), payload: req.body })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export const softDelete = async (req, res, next) => {
  try {
    await Salons.softDelete(req.params.id)
    await logAction(req, { action: 'SALON_DELETE', entity_type: 'salon', entity_id: Number(req.params.id) })
    res.json({ ok: true })
  } catch (e) { next(e) }
}
