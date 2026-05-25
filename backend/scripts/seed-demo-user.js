const bcrypt = require('bcryptjs')
const { db } = require('../src/db/pool')
const { env } = require('../src/config/env')

async function main() {
  // Use the provided admin password ('admin') for demo login convenience
  const passwordHash = await bcrypt.hash('admin', 10)

  await db.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   name = EXCLUDED.name,
                   role = EXCLUDED.role`,
    ['admin@kurtland.com', passwordHash, 'System Admin', 'admin'],
  )

  console.log(`Seeded demo user in ${env.databaseUrl ? 'connected database' : 'database'}`)
  await db.end()
}

main().catch(async (error) => {
  console.error(error)
  await db.end().catch(() => {})
  process.exit(1)
})
