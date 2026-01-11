import { pool } from '../config/db.js'

const getDb = (conn) => conn || pool

export const upsertOrder = async (payload, conn = null) => {
  const db = getDb(conn)
  const {
    external_id,
    order_id,
    source = 'custom',
    customer_id = null,
    amount = 0,
    order_total = null,
    currency = 'CAD',
    status = 'COMPLETED',
  } = payload
  if (!external_id) throw new Error('Order external_id is required')
  const insertSql = `
    INSERT INTO orders (external_id, order_id, source, customer_id, amount, order_total, currency, status)
    VALUES (?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      customer_id = VALUES(customer_id),
      order_id = VALUES(order_id),
      amount = VALUES(amount),
      order_total = VALUES(order_total),
      currency = VALUES(currency),
      status = VALUES(status)
  `
  await db.query(insertSql, [
    external_id,
    order_id || null,
    source,
    customer_id,
    amount,
    order_total,
    currency,
    status,
  ])
  const [rows] = await db.query(
    'SELECT id FROM orders WHERE source=? AND external_id=? AND is_deleted=0 LIMIT 1',
    [source, external_id]
  )
  return rows[0]?.id || null
}

export const replaceOrderProducts = async (orderId, products = [], conn = null) => {
  if (!orderId) return
  const db = getDb(conn)
  await db.query('DELETE FROM order_products WHERE order_id=?', [orderId])
  if (!products || !products.length) return
  for (const item of products) {
    if (!item || (!item.product_name && !item.product_id)) continue
    const price = item.product_price !== undefined ? Number(item.product_price) : null
    await db.query(
      `INSERT INTO order_products (order_id, product_id, product_name, product_price)
       VALUES (?,?,?,?)`,
      [orderId, item.product_id || null, item.product_name || '', price || 0]
    )
  }
}

export const getOrderWithProducts = async (orderId) => {
  if (!orderId) return null
  const [orders] = await pool.query(
    `SELECT id, external_id, order_id, source, amount, order_total, currency, created_at
       FROM orders WHERE id=? AND is_deleted=0 LIMIT 1`,
    [orderId]
  )
  if (!orders[0]) return null
  const [products] = await pool.query(
    `SELECT id, product_id, product_name, product_price, created_at
       FROM order_products WHERE order_id=? ORDER BY id ASC`,
    [orderId]
  )
  return { ...orders[0], products }
}

export const getByExternalId = async ({ source = 'custom', external_id }, conn = null) => {
  if (!external_id) return null
  const db = getDb(conn)
  const [rows] = await db.query(
    'SELECT id, external_id, order_id, source FROM orders WHERE source=? AND external_id=? AND is_deleted=0 LIMIT 1',
    [source, external_id]
  )
  return rows[0] || null
}

export const updateOrderById = async (orderId, payload = {}, conn = null) => {
  if (!orderId) return
  const db = getDb(conn)
  const allowed = ['external_id', 'order_id', 'source', 'amount', 'order_total', 'currency', 'status']
  const sets = []
  const values = []
  allowed.forEach((field) => {
    if (payload[field] !== undefined) {
      sets.push(`${field}=?`)
      values.push(payload[field])
    }
  })
  if (!sets.length) return
  values.push(orderId)
  await db.query(`UPDATE orders SET ${sets.join(', ')} WHERE id=? AND is_deleted=0`, values)
}
