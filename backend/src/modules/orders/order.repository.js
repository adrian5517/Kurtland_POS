const { db } = require('../../db/pool')
const { HttpError } = require('../../utils/http-error')

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
        `INSERT INTO order_items (order_id, product_id, sku, product_name, unit_price, unit_cost, quantity, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orderId, item.productId, item.sku, item.productName, item.unitPrice, item.unitCost ?? 0, item.quantity, item.subtotal],
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
    // Guard with `quantity >= $2` so concurrent/edge cases can never drive
    // stock negative. If no row matched, stock was insufficient.
    const result = await client.query(
      'UPDATE products SET quantity = quantity - $2 WHERE id = $1 AND quantity >= $2',
      [productId, quantity],
    )
    if (result.rowCount === 0) {
      throw new HttpError(409, 'Insufficient stock for one or more items')
    }
  },

  // Reduce the selling cashier's allocated stock for a product as they sell it.
  // Clamped at 0 and a no-op when the cashier has no assignment for the product
  // (e.g. an admin selling directly), so it never blocks a valid sale.
  async decrementCashierAllocation(client, productId, cashierId, quantity) {
    await client.query(
      `UPDATE product_cashier_assignments
       SET distributed_quantity = GREATEST(0, distributed_quantity - $3)
       WHERE product_id = $1 AND cashier_id = $2`,
      [productId, cashierId, quantity],
    )
  },

  async createLog(client, orderId, action, note) {
    await client.query(
      `INSERT INTO order_logs (order_id, action, note)
       VALUES ($1, $2, $3)`,
      [orderId, action, note]
    )
  },

  async findAllLogs(cashierId = null) {
    const params = []
    const cashierClause = cashierId ? ' AND o.cashier_id = $1' : ''
    if (cashierId) params.push(cashierId)

    const result = await db.query(
      `SELECT ol.id, ol.order_id, ol.action, ol.note, ol.created_at,
              o.cashier_id, o.cashier_email
       FROM order_logs ol
       LEFT JOIN orders o ON ol.order_id = o.id
       WHERE 1=1${cashierClause}
       ORDER BY ol.created_at DESC
       LIMIT 500`,
      params
    )
    return result.rows
  }
}

module.exports = { orderRepository }