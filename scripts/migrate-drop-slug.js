import 'dotenv/config'
import mysql from 'mysql2/promise'

const run = async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  })

  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='salons' AND COLUMN_NAME='slug'`,
    [process.env.DB_NAME]
  )
  if (cols.length) {
    // try to drop a unique index on slug if it exists
    const [idx] = await conn.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA=? AND TABLE_NAME='salons' AND COLUMN_NAME='slug'`,
      [process.env.DB_NAME]
    )
    for (const row of idx) {
      try {
        await conn.query(`DROP INDEX \`${row.INDEX_NAME}\` ON salons`)
        console.log(`Dropped index ${row.INDEX_NAME} on salons.slug`)
      } catch {}
    }
    await conn.query(`ALTER TABLE salons DROP COLUMN slug`)
    console.log('Dropped column salons.slug')
  } else {
    console.log('No slug column on salons — nothing to do.')
  }
  await conn.end()
}

run().catch(e => { console.error(e); process.exit(1) })
