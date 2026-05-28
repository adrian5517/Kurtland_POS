const bcrypt = require('bcryptjs')
const { db } = require('../src/db/pool')
const { env } = require('../src/config/env')

async function main() {
  // Use the provided passwords for demo login convenience
  const adminPasswordHash = await bcrypt.hash('admin', 10)
  const cashierPasswordHash = await bcrypt.hash('cashier123', 10)

  // Seed admin user
  await db.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   name = EXCLUDED.name,
                   role = EXCLUDED.role`,
    ['admin@kurtland.com', adminPasswordHash, 'System Admin', 'admin'],
  )
  console.log('✓ Seeded admin user: admin@kurtland.com')

  // Seed cashier accounts
  const cashierAccounts = [
    { email: 'cashier1@kurtland.com', name: 'Cashier One' },
    { email: 'cashier2@kurtland.com', name: 'Cashier Two' },
  ]

  for (const { email, name } of cashierAccounts) {
    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash,
                     name = EXCLUDED.name,
                     role = EXCLUDED.role`,
      [email, cashierPasswordHash, name, 'cashier'],
    )
    console.log(`✓ Seeded cashier user: ${email}`)
  }

  console.log(`\nSeeded demo users in ${env.databaseUrl ? 'connected database' : 'database'}`)
  await db.end()
}

main().catch(async (error) => {
  console.error(error)
  await db.end().catch(() => {})
  process.exit(1)
})
