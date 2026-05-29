const bcrypt = require('bcryptjs')
const { db } = require('./pool')

const STARTER_PRODUCTS = [
  { name: 'Margherita Pizza', sku: 'PIZ001', price: 250, quantity: 15 },
  { name: 'Pepperoni Pizza', sku: 'PIZ002', price: 300, quantity: 2 },
  { name: 'Chicken Burger', sku: 'BRG001', price: 180, quantity: 20 },
  { name: 'Beef Burger', sku: 'BRG002', price: 200, quantity: 3 },
  { name: 'Coca Cola', sku: 'DRK001', price: 50, quantity: 50 },
  { name: 'Fresh Orange Juice', sku: 'DRK002', price: 80, quantity: 8 },
  { name: 'Chocolate Cake', sku: 'DES001', price: 120, quantity: 10 },
  { name: 'Ice Cream', sku: 'DES002', price: 100, quantity: 25 },
  { name: 'Caesar Salad', sku: 'SAL001', price: 150, quantity: 15 },
  { name: 'Greek Salad', sku: 'SAL002', price: 140, quantity: 12 },
  { name: 'Spaghetti', sku: 'PAT001', price: 220, quantity: 20 },
  { name: 'Penne Arrabbiata', sku: 'PAT002', price: 210, quantity: 16 },
]

async function bootstrapDatabase() {
  // Ensure is_active column exists for databases created before this migration
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true
  `).catch(() => { /* table may not exist yet, created below */ })

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'Products',
      price NUMERIC(10, 2) NOT NULL,
      srp_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 5,
      quantity INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      image_public_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      cashier_id INTEGER NOT NULL,
      cashier_email TEXT NOT NULL,
      total_amount NUMERIC(10, 2) NOT NULL,
      amount_paid NUMERIC(10, 2) NOT NULL,
      change_amount NUMERIC(10, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price NUMERIC(10, 2) NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      subtotal NUMERIC(10, 2) NOT NULL
    );
  `)

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_logs (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS idx_order_logs_order_id ON order_logs(order_id)')

  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS products_sku_idx ON products (sku)')
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)')
  await db.query(`
    CREATE TABLE IF NOT EXISTS sku_counters (
      prefix TEXT PRIMARY KEY,
      last_value INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Products'")
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS srp_price NUMERIC(10, 2) NOT NULL DEFAULT 0')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_public_id TEXT')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 5')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false')

  // Create product_cashier_assignments table for product distribution
  await db.query(`
    CREATE TABLE IF NOT EXISTS product_cashier_assignments (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      cashier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(product_id, cashier_id)
    )
  `)
  await db.query('CREATE INDEX IF NOT EXISTS idx_product_cashier_product ON product_cashier_assignments(product_id)')
  await db.query('CREATE INDEX IF NOT EXISTS idx_product_cashier_cashier ON product_cashier_assignments(cashier_id)')

  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM products')

  if (rows[0]?.count === 0) {
    for (const product of STARTER_PRODUCTS) {
      await db.query(
        `INSERT INTO products (name, sku, category, price, srp_price, min_stock, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (sku) DO NOTHING`,
        [product.name, product.sku, product.category || 'Products', product.price, 0, 5, product.quantity],
      )
    }
  }

  // Seed default admin user if no users exist
  const userCheck = await db.query('SELECT COUNT(*)::int AS count FROM users')
  if (userCheck.rows[0]?.count === 0) {
    const bcryptjs = require('bcryptjs')
    const hashedPassword = await bcryptjs.hash('admin123', 10)
    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@kurt-land.com', hashedPassword, 'Admin User', 'admin'],
    )
    console.log('✓ Default admin user created: admin@kurt-land.com / admin123')
  }

    // Seed/repair sku_counters from existing products to ensure counters start
    // after the highest suffix observed for each prefix (first-3-letter prefix).
    await db.query(`
      WITH parts AS (
        SELECT sku,
               UPPER(regexp_replace(sku, '\\d+$', '')) AS prefix_letters,
               regexp_replace(sku, '^\\D+', '') AS suffix_digits
        FROM products
        WHERE sku ~ '\\d$'
      ),
      agg AS (
        SELECT SUBSTRING(prefix_letters FROM 1 FOR 3) AS prefix3,
               MAX(COALESCE(NULLIF(suffix_digits, ''), '0')::int) AS max_suffix
        FROM parts
        GROUP BY SUBSTRING(prefix_letters FROM 1 FOR 3)
      )
      INSERT INTO sku_counters(prefix, last_value)
      SELECT prefix3, max_suffix FROM agg
      ON CONFLICT (prefix) DO UPDATE
      SET last_value = GREATEST(sku_counters.last_value, EXCLUDED.last_value)
    `)

  // Seed demo users
  const adminPasswordHash = await bcrypt.hash('admin', 10)
  const cashierPasswordHash = await bcrypt.hash('cashier123', 10)

  // Check if admin user exists
  const { rows: adminRows } = await db.query('SELECT id FROM users WHERE email = $1', ['admin@kurtland.com'])
  if (adminRows.length === 0) {
    await db.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)`,
      ['admin@kurtland.com', adminPasswordHash, 'System Admin', 'admin'],
    )
    console.log('✓ Seeded admin user: admin@kurtland.com / password: admin')
  }

  // Check if cashier users exist
  const { rows: cashierRows } = await db.query('SELECT id FROM users WHERE role = $1', ['cashier'])
  if (cashierRows.length === 0) {
    const cashierAccounts = [
      { email: 'cashier1@kurtland.com', name: 'Cashier One' },
      { email: 'cashier2@kurtland.com', name: 'Cashier Two' },
    ]

    for (const { email, name } of cashierAccounts) {
      await db.query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)`,
        [email, cashierPasswordHash, name, 'cashier'],
      )
      console.log(`✓ Seeded cashier user: ${email} / password: cashier123`)
    }
  }
}
module.exports = { bootstrapDatabase }