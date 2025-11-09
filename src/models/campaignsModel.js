import { pool } from '../config/db.js'

export const create = async ({ name, slug, starts_at, ends_at, is_active = 1 }) => {
  const [res] = await pool.query(
    'INSERT INTO campaigns (name, slug, starts_at, ends_at, is_active) VALUES (?,?,?,?,?)',
    [name, slug, starts_at || null, ends_at || null, is_active]
  )
  return res.insertId
}

export const list = async () => {
  const [rows] = await pool.query('SELECT * FROM campaigns WHERE is_deleted=0 ORDER BY created_at DESC')
  return rows
}

export const update = async (id, payload) => {
  const fields = ['name','slug','starts_at','ends_at','is_active']
  const sets = []
  const vals = []
  fields.forEach(f => {
    if (payload[f] !== undefined) { sets.push(`${f}=?`); vals.push(payload[f]) }
  })
  if (!sets.length) return
  vals.push(id)
  await pool.query(`UPDATE campaigns SET ${sets.join(', ')} WHERE id=? AND is_deleted=0`, vals)
}

export const softDelete = async (id) => {
  await pool.query('UPDATE campaigns SET is_deleted=1, deleted_at=NOW() WHERE id=? AND is_deleted=0', [id])
}
