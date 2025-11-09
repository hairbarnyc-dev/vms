import { pool } from '../config/db.js'

export const createAudit = async (row) => {
  const { actor_user_id, action, entity_type, entity_id, ip, ua, payload } = row
  await pool.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, ip, ua, payload)
     VALUES (?,?,?,?,?,?,?)`,
    [actor_user_id, action, entity_type, entity_id, ip, ua, payload]
  )
}
