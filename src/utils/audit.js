import { createAudit } from '../models/auditModel.js'

export const logAction = async (req, { actor_user_id, action, entity_type, entity_id = null, payload = null }) => {
  try {
    await createAudit({
      actor_user_id: actor_user_id ?? req?.user?.id ?? null,
      action,
      entity_type,
      entity_id,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
      ua: req.headers['user-agent'] || null,
      payload: payload ? JSON.stringify(payload) : null
    })
  } catch { /* do not block main flow on audit failure */ }
}
