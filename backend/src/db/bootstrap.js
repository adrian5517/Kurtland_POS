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
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'Products',
      price NUMERIC(10, 2) NOT NULL,
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

  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS products_sku_idx ON products (sku)')
  await db.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Products'")
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT')
  await db.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_public_id TEXT')

  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM products')

  if (rows[0]?.count === 0) {
    for (const product of STARTER_PRODUCTS) {
      await db.query(
        `INSERT INTO products (name, sku, category, price, quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (sku) DO NOTHING`,
        [product.name, product.sku, product.category || 'Products', product.price, product.quantity],
      )
    }
  }
}

module.exports = { bootstrapDatabase }