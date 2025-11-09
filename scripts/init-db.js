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
    multipleStatements: true
  })
  const schema = fs.readFileSync(path.join('sql', '01_schema.sql'), 'utf8')
  await conn.query(schema)
  console.log('Schema created ✅')
  await conn.end()
}
run().catch(e => { console.error(e); process.exit(1) })
