const { Router } = require('express')

const { healthRouter } = require('./health.routes')
const { productRouter } = require('../modules/products/product.routes')
const { authRouter } = require('../modules/auth/auth.routes')
const { orderRouter } = require('../modules/orders/order.routes')
const { uploadRouter } = require('../modules/uploads/upload.routes')

const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/products', productRouter)
apiRouter.use('/orders', orderRouter)
apiRouter.use('/uploads', uploadRouter)

module.exports = { apiRouter }