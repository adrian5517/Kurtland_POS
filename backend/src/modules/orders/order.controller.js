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
}

module.exports = { orderController }