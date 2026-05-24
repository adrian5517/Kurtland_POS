const { Router } = require('express')

const { requireAuth } = require('../../middleware/auth')
const { orderController } = require('./order.controller')

const orderRouter = Router()

orderRouter.use(requireAuth)
orderRouter.post('/', orderController.store)
orderRouter.get('/logs', orderController.getLogs)

module.exports = { orderRouter }