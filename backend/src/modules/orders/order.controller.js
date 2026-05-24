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
      const logs = await orderService.getOrderLogs()
      return res.status(200).json({ data: logs })
    } catch (error) {
      next(error)
    }
  }
}

module.exports = { orderController }