import { pool } from '../config/db.js'

export const create = async (payload) => {
  const {
    name, phone, email, address_line1, address_line2, city, region, postal_code, country
  } = payload
  const [res] = await pool.query(
    `INSERT INTO salons
     (name, phone, email, address_line1, address_line2, city, region, postal_code, country)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [name, phone || null, email || null, address_line1 || null, address_line2 || null,
     city || null, region || null, postal_code || null, country || 'CA']
  )
  return res.insertId
}

export const list = async () => {
  const [rows] = await pool.query('SELECT * FROM salons WHERE is_deleted=0 ORDER BY created_at DESC')
  return rows
}

export const get = async (id) => {
  const [rows] = await pool.query('SELECT * FROM salons WHERE id=? AND is_deleted=0', [id])
  return rows[0]
}

export const update = async (id, payload) => {
  const fields = ['name','phone','email','address_line1','address_line2','city','region','postal_code','country','is_active']
  const sets = []
  const vals = []
  for (const f of fields) {
    if (payload[f] !== undefined) { sets.push(`${f}=?`); vals.push(payload[f]) }
  }
  if (!sets.length) return
  vals.push(id)
  await pool.query(`UPDATE salons SET ${sets.join(', ')} WHERE id=? AND is_deleted=0`, vals)
}

export const softDelete = async (id) => {
  await pool.query('UPDATE salons SET is_deleted=1, deleted_at=NOW() WHERE id=? AND is_deleted=0', [id])
}
