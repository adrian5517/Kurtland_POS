const { db } = require('../../db/pool')

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
    const result = await db.query(
      `INSERT INTO products (name, sku, category, price, srp_price, quantity, is_active, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, sku, category, price::text, srp_price::text, quantity, is_active, image_url, image_public_id, created_at::text`,
      [
        input.name,
        input.sku,
        input.category,
        input.price,
        input.srpPrice ?? 0.00,                 // Fallback to 0 kung walang srp na pinasa
        input.quantity ?? 0,
        input.isActive ?? true,                 // Default value helper
        input.imageUrl ?? null,
        input.imagePublicId ?? null,
      ],
    )

    return result.rows[0]
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
        `SELECT id, name, sku, category, price::text, srp_price::text, quantity, is_active, image_url, image_public_id, created_at::text 
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
       RETURNING id, name, sku, category, price::text, srp_price::text, quantity, is_active, image_url, image_public_id, created_at::text`,
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