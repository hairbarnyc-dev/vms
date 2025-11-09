import * as Campaigns from '../models/campaignsModel.js'
import { logAction } from '../utils/audit.js'

export const create = async (req, res, next) => {
  try {
    const id = await Campaigns.create(req.body)
    await logAction(req, { action: 'CAMPAIGN_CREATE', entity_type: 'campaign', entity_id: id, payload: req.body })
    res.status(201).json({ id })
  } catch (e) { next(e) }
}

export const list = async (_req, res, next) => {
  try { res.json(await Campaigns.list()) } catch (e) { next(e) }
}

export const update = async (req, res, next) => {
  try {
    await Campaigns.update(req.params.id, req.body)
    await logAction(req, { action: 'CAMPAIGN_UPDATE', entity_type: 'campaign', entity_id: Number(req.params.id), payload: req.body })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

export const softDelete = async (req, res, next) => {
  try {
    await Campaigns.softDelete(req.params.id)
    await logAction(req, { action: 'CAMPAIGN_DELETE', entity_type: 'campaign', entity_id: Number(req.params.id) })
    res.json({ ok: true })
  } catch (e) { next(e) }
}
