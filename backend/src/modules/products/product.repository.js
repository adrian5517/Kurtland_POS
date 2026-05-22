const { db } = require('../../db/pool')

const productRepository = {
  async findAll() {
    const result = await db.query(
      'SELECT id, name, sku, category, price::text, quantity, image_url, image_public_id, created_at::text FROM products ORDER BY id DESC',
    )
    return result.rows
  },

  async create(input) {
    const result = await db.query(
      `INSERT INTO products (name, sku, category, price, quantity, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, sku, category, price::text, quantity, image_url, image_public_id, created_at::text`,
      [
        input.name,
        input.sku,
        input.category,
        input.price,
        input.quantity ?? 0,
        input.imageUrl ?? null,
        input.imagePublicId ?? null,
      ],
    )

    return result.rows[0]
  },

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
    pushField('quantity', input.quantity)
    if (Object.prototype.hasOwnProperty.call(input, 'imageUrl')) {
      pushField('image_url', input.imageUrl)
    }

    if (Object.prototype.hasOwnProperty.call(input, 'imagePublicId')) {
      pushField('image_public_id', input.imagePublicId)
    }

    if (!fields.length) {
      const current = await db.query(
        'SELECT id, name, sku, category, price::text, quantity, image_url, image_public_id, created_at::text FROM products WHERE id = $1',
        [id],
      )

      return current.rows[0] || null
    }

    values.push(id)

    const result = await db.query(
      `UPDATE products
       SET ${fields.join(', ')}
       WHERE id = $${values.length}
       RETURNING id, name, sku, category, price::text, quantity, image_url, image_public_id, created_at::text`,
      values,
    )

    return result.rows[0] || null
  },

  async delete(id) {
    const result = await db.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id],
    )

    return result.rows[0] || null
  },
}

module.exports = { productRepository }