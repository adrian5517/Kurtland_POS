const { orderService } = require('./order.service')

const orderController = {
  async store(req, res, next) {
    try {
      const order = await orderService.createOrder(req.body, req.user)
      return res.status(201).json({ data: order })
    } catch (error) {
      next(error)
    }
  },

  async getLogs(req, res, next) {
    try {
      const { cashier_id } = req.query
      // Validate cashier_id: must be a positive integer if provided
      const cashierId = cashier_id && /^\d+$/.test(cashier_id) ? parseInt(cashier_id, 10) : null
      const logs = await orderService.getOrderLogs(cashierId)
      return res.status(200).json({ data: logs })
    } catch (error) {
      next(error)
    }
  }
}

module.exports = { orderController }