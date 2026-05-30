const { db } = require('../../db/pool')

function deriveSkuPrefix(category, fallbackSku = '') {
  const base = String(category || fallbackSku || 'PRD').toUpperCase()
  const letters = base.replace(/[^A-Z]/g, '')
  return (letters.slice(0, 3).padEnd(3, 'X'))
}

function nextSkuForPrefix(prefix, existingSkus = []) {
  const maxSuffix = existingSkus
    .filter((sku) => sku && sku.startsWith(prefix))
    .map((sku) => {
      const suffix = sku.slice(prefix.length).replace(/^0+/, '')
      return parseInt(suffix || '0', 10) || 0
    })
    .reduce((max, value) => Math.max(max, value), 0)

  return `${prefix}${String(maxSuffix + 1).padStart(3, '0')}`
}

async function findExistingSkusByPrefix(prefix) {
  const result = await db.query('SELECT sku FROM products WHERE sku LIKE $1 ORDER BY sku ASC', [`${prefix}%`])
  return result.rows.map((row) => row.sku)
}

async function getNextSkuSuffix(prefix) {
  // Atomically insert or increment the counter for this prefix and return the new value
  const result = await db.query(
    `INSERT INTO sku_counters(prefix, last_value)
     VALUES ($1, 1)
     ON CONFLICT (prefix) DO UPDATE
       SET last_value = sku_counters.last_value + 1
     RETURNING last_value`,
    [prefix],
  )

  return result.rows[0].last_value
}

const productRepository = {
  // 1. Kasama na ang is_active at srp_price sa listahan ng kinukuha
  async findAll() {
    const result = await db.query(
      `SELECT id, name, sku, category, price::text, srp_price::text, min_stock, quantity, is_active, image_url, image_public_id, created_at::text 
       FROM products 
       WHERE is_deleted = false 
       ORDER BY id DESC`,
    )
    return result.rows
  },

  // 2. Isinama ang is_active (defaulting to true) at srp_price sa insertion query matrix
  async create(input) {
    const prefix = deriveSkuPrefix(input.category)

    // If caller provided an explicit SKU, prefer and validate it at insertion time.
    let skuToUse = (input.sku && String(input.sku).trim()) || null

    const attemptInsert = async (sku) => db.query(
      `INSERT INTO products (name, sku, category, price, srp_price, min_stock, quantity, is_active, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, sku, category, price::text, srp_price::text, min_stock, quantity, is_active, image_url, image_public_id, created_at::text`,
      [
        input.name,
        sku,
        input.category,
        input.price,
        input.srpPrice ?? input.srp_price ?? 0.00,
        input.minStock ?? input.min_stock ?? 5,
        input.quantity ?? 0,
        input.isActive ?? input.is_active ?? true,
        input.imageUrl ?? input.image_url ?? null,
        input.imagePublicId ?? input.image_public_id ?? null,
      ],
    )

    try {
      // If no SKU provided, allocate one atomically from sku_counters
      if (!skuToUse) {
        const nextVal = await getNextSkuSuffix(prefix)
        skuToUse = `${prefix}${String(nextVal).padStart(3, '0')}`
      }

      const result = await attemptInsert(skuToUse)
      return result.rows[0]
    } catch (error) {
      // Handle rare unique-constraint collisions: allocate a fresh suffix and retry once.
      if (error?.code !== '23505') {
        throw error
      }

      const nextVal = await getNextSkuSuffix(prefix)
      const retrySku = `${prefix}${String(nextVal).padStart(3, '0')}`
      const retry = await attemptInsert(retrySku)
      return retry.rows[0]
    }
  },

  // 3. Dynamic payload compiler modification para sa flexible updates
  async update(id, input) {
    const fields = []
    const values = []

    const pushField = (column, value) => {
      if (value === undefined) {
        return
      }
      values.push(value)
      fields.push(`${column} = $${values.length}`)
    }

    pushField('name', input.name)
    pushField('sku', input.sku)
    pushField('category', input.category)
    pushField('price', input.price)
    pushField('srp_price', input.srpPrice !== undefined ? input.srpPrice : input.srp_price)      // 💡 Dinagdag para sa dynamic query engine
    pushField('min_stock', input.minStock !== undefined ? input.minStock : input.min_stock)
    pushField('quantity', input.quantity)
    pushField('is_active', input.isActive !== undefined ? input.isActive : input.is_active)      // 💡 Dinagdag para sa toggle action updates
    pushField('is_deleted', input.isDeleted !== undefined ? input.isDeleted : input.is_deleted)

    if (Object.prototype.hasOwnProperty.call(input, 'imageUrl') || Object.prototype.hasOwnProperty.call(input, 'image_url')) {
      pushField('image_url', input.imageUrl !== undefined ? input.imageUrl : input.image_url)
    }

    if (Object.prototype.hasOwnProperty.call(input, 'imagePublicId') || Object.prototype.hasOwnProperty.call(input, 'image_public_id')) {
      pushField('image_public_id', input.imagePublicId !== undefined ? input.imagePublicId : input.image_public_id)
    }

    // Fallback block if empty schema arrays were verified
    if (!fields.length) {
      const current = await db.query(
        `SELECT id, name, sku, category, price::text, srp_price::text, min_stock, quantity, is_active, image_url, image_public_id, created_at::text 
         FROM products 
         WHERE id = $1`,
        [id],
      )

      return current.rows[0] || null
    }

    values.push(id)
    console.debug('productRepository.update', { fields, values, id })

    const result = await db.query(
      `UPDATE products
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, sku, category, price::text, srp_price::text, min_stock, quantity, is_active, image_url, image_public_id, created_at::text`,
      values,
    )

    return result.rows[0] || null
  },

  // 4. Safely sets is_deleted to true (unmodified legacy soft delete architecture)
  async delete(id) {
    const result = await db.query(
      'UPDATE products SET is_deleted = true WHERE id = $1 RETURNING id',
      [id],
    )

    return result.rows[0] || null
  },

  // 5. Get products assigned to a specific cashier
  async findByCashierId(cashierId) {
    const result = await db.query(
      `SELECT p.id, p.name, p.sku, p.category, p.price::text, p.srp_price::text, p.min_stock, 
              p.quantity, p.is_active, p.image_url, p.image_public_id, p.created_at::text
       FROM products p
       INNER JOIN product_cashier_assignments pca ON p.id = pca.product_id
       WHERE pca.cashier_id = $1 AND p.is_deleted = false
       ORDER BY p.id DESC`,
      [cashierId],
    )
    return result.rows
  },

  // 6. Assign product to a cashier
  async assignToCashier(productId, cashierId) {
    const result = await db.query(
      `INSERT INTO product_cashier_assignments (product_id, cashier_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (product_id, cashier_id) DO NOTHING
       RETURNING id`,
      [productId, cashierId],
    )
    return result.rows[0] || null
  },

  // 7. Remove product from cashier
  async removeFromCashier(productId, cashierId) {
    const result = await db.query(
      `DELETE FROM product_cashier_assignments
       WHERE product_id = $1 AND cashier_id = $2
       RETURNING id`,
      [productId, cashierId],
    )
    return result.rows[0] || null
  },

  // 8. Get all cashiers assigned to a product
  async getCashiersForProduct(productId) {
    const result = await db.query(
      `SELECT DISTINCT cashier_id FROM product_cashier_assignments
       WHERE product_id = $1`,
      [productId],
    )
    return result.rows.map(row => row.cashier_id)
  },

  // 9. Get all cashiers (from users table)
  async getAllCashiers() {
    const result = await db.query(
      `SELECT id, email FROM users WHERE role = 'cashier' ORDER BY email ASC`,
    )
    return result.rows
  },

  // 10. Get comprehensive cashier analytics with product details, costs, and profit potential
  async getCashierAnalytics() {
    const result = await db.query(
      `SELECT 
         u.id,
         u.email,
         COUNT(DISTINCT pca.product_id) as total_products,
         COALESCE(SUM(p.price::numeric * p.quantity), 0) as inventory_cost,
         COALESCE(SUM((p.srp_price::numeric - p.price::numeric) * p.quantity), 0) as profit_potential,
         COALESCE(SUM(CASE WHEN p.quantity < p.min_stock THEN 1 ELSE 0 END), 0) as stock_alerts_count,
         JSON_AGG(
           CASE WHEN p.quantity < p.min_stock THEN
             JSON_BUILD_OBJECT(
               'product_id', p.id,
               'product_name', p.name,
               'quantity', p.quantity,
               'min_stock', p.min_stock
             )
           END
         ) FILTER (WHERE p.quantity < p.min_stock) as stock_alerts,
         JSON_AGG(
           JSON_BUILD_OBJECT(
             'id', p.id,
             'name', p.name,
             'sku', p.sku,
             'price', p.price::text,
             'srp_price', p.srp_price::text,
             'quantity', p.quantity,
             'min_stock', p.min_stock,
             'profit_per_unit', (p.srp_price::numeric - p.price::numeric)::text
           )
         ) FILTER (WHERE pca.product_id IS NOT NULL) as products
       FROM users u
       LEFT JOIN product_cashier_assignments pca ON u.id = pca.cashier_id
       LEFT JOIN products p ON pca.product_id = p.id AND p.is_deleted = false
       WHERE u.role = 'cashier'
       GROUP BY u.id, u.email
       ORDER BY u.email ASC`,
    )
    return result.rows
  },
}

module.exports = { productRepository }