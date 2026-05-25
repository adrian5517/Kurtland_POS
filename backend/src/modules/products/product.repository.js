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
      `SELECT id, name, sku, category, price::text, srp_price::text, quantity, is_active, image_url, image_public_id, created_at::text 
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
        input.srpPrice ?? 0.00,
        input.minStock ?? 5,
        input.quantity ?? 0,
        input.isActive ?? true,
        input.imageUrl ?? null,
        input.imagePublicId ?? null,
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
    pushField('srp_price', input.srpPrice)      // 💡 Dinagdag para sa dynamic query engine
    pushField('min_stock', input.minStock)
    pushField('quantity', input.quantity)
    pushField('is_active', input.isActive)      // 💡 Dinagdag para sa toggle action updates

    if (Object.prototype.hasOwnProperty.call(input, 'imageUrl')) {
      pushField('image_url', input.imageUrl)
    }

    if (Object.prototype.hasOwnProperty.call(input, 'imagePublicId')) {
      pushField('image_public_id', input.imagePublicId)
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
}

module.exports = { productRepository }