import fs from 'fs'
import path from 'path'
import mysql from 'mysql2/promise'
import 'dotenv/config'

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    multipleStatements: true
  })
  const seed = fs.readFileSync(path.join('sql', '02_seed.sql'), 'utf8')
  await conn.query(seed)
  console.log('Seeded ✅ (admin@vms.local / Admin@12345)')
  await conn.end()
}
run().catch(e => { console.error(e); process.exit(1) })
