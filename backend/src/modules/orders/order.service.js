const { db } = require('../../db/pool')
const { HttpError } = require('../../utils/http-error')
const { createOrderSchema } = require('./order.schema')
const { orderRepository } = require('./order.repository')

function toNumber(value) {
  return Number(value)
}

function toReceiptOrder(order, items, cashierName) {
  return {
    transactionId: `ORD-${String(order.id).padStart(6, '0')}`,
    items: items.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: item.unitPrice,
      subtotal: item.subtotal,
    })),
    total: toNumber(order.total_amount),
    amountPaid: toNumber(order.amount_paid),
    change: toNumber(order.change_amount),
    cashierName,
    timestamp: new Date(order.created_at).toLocaleString(),
  }
}

const orderService = {
  async createOrder(input, user) {
    const parsed = createOrderSchema.safeParse(input)

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid order payload')
    }

    const client = await db.connect()

    try {
      await client.query('BEGIN')

      const ids = [...new Set(parsed.data.items.map((item) => Number(item.id)))]
      const products = await orderRepository.findProductsByIds(client, ids)

      if (products.length !== ids.length) {
        throw new HttpError(404, 'One or more products could not be found')
      }

      const productMap = new Map(products.map((product) => [product.id, product]))

      const orderItems = parsed.data.items.map((item) => {
        const productId = Number(item.id)
        const product = productMap.get(productId)

        if (!product) {
          throw new HttpError(404, `Product ${item.name} could not be found`)
        }

        if (product.quantity < item.quantity) {
          throw new HttpError(409, `${product.name} has insufficient stock`)
        }

        const unitPrice = toNumber(product.price)
        return {
          productId,
          sku: product.sku,
          productName: product.name,
          unitPrice,
          quantity: item.quantity,
          subtotal: unitPrice * item.quantity,
        }
      })

      const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0)

      if (parsed.data.totalAmount && Math.abs(parsed.data.totalAmount - totalAmount) > 0.01) {
        throw new HttpError(400, 'Order total does not match the selected items')
      }

      if (parsed.data.amountPaid < totalAmount) {
        throw new HttpError(400, 'Amount paid must cover the order total')
      }

      const changeAmount = parsed.data.amountPaid - totalAmount

      const order = await orderRepository.createOrder(client, {
        cashierId: user.id,
        cashierEmail: user.email,
        totalAmount,
        amountPaid: parsed.data.amountPaid,
        changeAmount,
      })

      await orderRepository.createItems(client, order.id, orderItems)

      for (const item of orderItems) {
        await orderRepository.decrementStock(client, item.productId, item.quantity)
      }

      await client.query('COMMIT')

      return toReceiptOrder(order, orderItems, user.name || user.email)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
}

module.exports = { orderService }