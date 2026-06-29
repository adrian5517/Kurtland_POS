const { db } = require('../../db/pool')
const { HttpError } = require('../../utils/http-error')
const { createOrderSchema } = require('./order.schema')
const { orderRepository } = require('./order.repository')

function toNumber(value) {
  return Number(value)
}

function formatReceiptTimestamp(dateValue) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(dateValue))
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
    timestamp: formatReceiptTimestamp(order.created_at),
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

      // Merge duplicate line items by product id, so the stock check and
      // decrement account for the TOTAL requested quantity of each product
      // (otherwise two lines of the same product could each pass the check
      // against full stock and oversell).
      const quantityByProduct = new Map()
      for (const item of parsed.data.items) {
        const productId = Number(item.id)
        quantityByProduct.set(productId, (quantityByProduct.get(productId) || 0) + Number(item.quantity))
      }

      const orderItems = [...quantityByProduct.entries()].map(([productId, quantity]) => {
        const product = productMap.get(productId)

        if (!product) {
          throw new HttpError(404, `Product ${productId} could not be found`)
        }

        if (product.quantity < quantity) {
          throw new HttpError(409, `${product.name} has insufficient stock`)
        }

        const unitPrice = toNumber(product.srp_price ?? product.price)
        return {
          productId,
          sku: product.sku,
          productName: product.name,
          unitPrice,
          quantity,
          subtotal: unitPrice * quantity,
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

      // 1. Create the base Order document
      const order = await orderRepository.createOrder(client, {
        cashierId: user.id,
        cashierEmail: user.email,
        totalAmount,
        amountPaid: parsed.data.amountPaid,
        changeAmount,
      })

      // 2. LOG ENTRY: Order initialization tracking
      await orderRepository.createLog(
        client,
        order.id,
        'ORDER_CREATED',
        `Order registered successfully by cashier ${user.email} with total balance PHP ${totalAmount.toFixed(2)}.`
      )

      // 3. Mount item matrices
      await orderRepository.createItems(client, order.id, orderItems)

      // 4. Update core warehouse stock distributions and log individual updates
      for (const item of orderItems) {
        await orderRepository.decrementStock(client, item.productId, item.quantity)

        // Also shrink the selling cashier's allocated stock (no-op for admins).
        await orderRepository.decrementCashierAllocation(client, item.productId, user.id, item.quantity)

        await orderRepository.createLog(
          client,
          order.id,
          'STOCK_DECREMENTED',
          `Reduced stock for item "${item.productName}" (SKU: ${item.sku}) by quantity ${item.quantity}.`
        )
      }

      // 5. FINAL LOG ENTRY: Lifecycle validation checkout confirmation
      await orderRepository.createLog(
        client,
        order.id,
        'CHECKOUT_COMPLETED',
        `Payment finalized. Received: PHP ${parsed.data.amountPaid.toFixed(2)}. Change Given: PHP ${changeAmount.toFixed(2)}.`
      )

      await client.query('COMMIT')

      return toReceiptOrder(order, orderItems, user.name || user.email)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
  async getOrderLogs(cashierId = null) {
    return await orderRepository.findAllLogs(cashierId)
  }
}

module.exports = { orderService }