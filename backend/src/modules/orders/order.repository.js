const { db } = require('../../db/pool')

const orderRepository = {
  async createOrder(client, input) {
    const result = await client.query(
  `INSERT INTO orders (cashier_id, cashier_email, total_amount, amount_paid, change_amount)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, cashier_id, cashier_email, total_amount::text, amount_paid::text, change_amount::text, created_at`,
  [input.cashierId, input.cashierEmail, input.totalAmount, input.amountPaid, input.changeAmount],
)

    return result.rows[0]
  },

  async createItems(client, orderId, items) {
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, sku, product_name, unit_price, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orderId, item.productId, item.sku, item.productName, item.unitPrice, item.quantity, item.subtotal],
      )
    }
  },

  async findProductsByIds(client, ids) {
    const result = await client.query(
      `SELECT id, name, sku, price::text, srp_price::text, quantity
       FROM products
       WHERE id = ANY($1::int[])
       FOR UPDATE`,
      [ids],
    )

    return result.rows
  },

  async decrementStock(client, productId, quantity) {
    await client.query(
      'UPDATE products SET quantity = quantity - $2 WHERE id = $1',
      [productId, quantity],
    )
  },

  async createLog(client, orderId, action, note) {
    await client.query(
      `INSERT INTO order_logs (order_id, action, note)
       VALUES ($1, $2, $3)`,
      [orderId, action, note]
    )
  },

  async findAllLogs() {
    const result = await db.query(
      `SELECT id, order_id, action, note, created_at 
       FROM order_logs 
       ORDER BY created_at DESC 
       LIMIT 200`
    )
    return result.rows
  }
}

module.exports = { orderRepository }