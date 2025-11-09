import { pool } from '../config/db.js'

export const findByEmail = async (email) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email=? AND is_deleted=0 LIMIT 1', [email])
  return rows[0]
}

export const createUser = async ({ email, password_hash, first_name, last_name, role_id }) => {
  const [res] = await pool.query(
    'INSERT INTO users (email, password_hash, first_name, last_name, role_id) VALUES (?,?,?,?,?)',
    [email, password_hash, first_name || null, last_name || null, role_id]
  )
  return res.insertId
}

export const mapUserToSalon = async ({ user_id, salon_id, role_in_salon = 'ADMIN' }) => {
  await pool.query(
    'INSERT INTO salon_users (salon_id, user_id, role_in_salon) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role_in_salon=VALUES(role_in_salon), is_deleted=0, deleted_at=NULL',
    [salon_id, user_id, role_in_salon]
  )
}

export const grantPermissions = async (user_id, permCodes = []) => {
  if (!permCodes.length) return
  const values = permCodes.map(code => `(${user_id}, ${pool.escape(code)})`).join(',')
  await pool.query(`INSERT IGNORE INTO user_permissions (user_id, perm_code) VALUES ${values}`)
}

export const getSalonAdminUser = async (salon_id) => {
  const [rows] = await pool.query(
    `SELECT u.* FROM users u
     JOIN salon_users su ON su.user_id=u.id AND su.salon_id=? AND su.role_in_salon='ADMIN' AND su.is_deleted=0
     WHERE u.is_deleted=0
     ORDER BY u.id ASC
     LIMIT 1`,
    [salon_id]
  )
  return rows[0]
}

export const updateUserEmailAndPassword = async (user_id, { email, password_hash }) => {
  const sets = []
  const vals = []
  if (email !== undefined) { sets.push('email=?'); vals.push(email) }
  if (password_hash !== undefined) { sets.push('password_hash=?'); vals.push(password_hash) }
  if (!sets.length) return
  vals.push(user_id)
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=? AND is_deleted=0`, vals)
}

export const getBasicById = async (id) => {
  const [rows] = await pool.query(
    'SELECT id, email, first_name, last_name FROM users WHERE id=? AND is_deleted=0 LIMIT 1',
    [id]
  )
  return rows[0] || null
}

export const updatePasswordById = async (id, password_hash) => {
  await pool.query('UPDATE users SET password_hash=? WHERE id=? AND is_deleted=0', [password_hash, id])
}

export const findByEmailAny = async (email) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email=? AND is_deleted=0 LIMIT 1', [email])
  return rows[0] || null
}