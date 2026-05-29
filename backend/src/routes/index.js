const { Router } = require('express')

const { healthRouter } = require('./health.routes')
const { productRouter } = require('../modules/products/product.routes')
const { authRouter } = require('../modules/auth/auth.routes')
// 💡 FIXED: Changed order.router to order.routes to match your file system spelling
const { orderRouter } = require('../modules/orders/order.routes') 
const { uploadRouter } = require('../modules/uploads/upload.routes')
const { reportRouter } = require('../modules/reports/report.routes')
const { userRouter } = require('../modules/auth/user.routes')
const { budgetRequestRouter } = require('../modules/budget-requests/budget-request.routes')
const { budgetReturnRouter } = require('../modules/budget-returns/budget-return.routes')

const apiRouter = Router()

apiRouter.use(healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/users', userRouter)
apiRouter.use('/products', productRouter)
apiRouter.use('/orders', orderRouter)
apiRouter.use('/uploads', uploadRouter)
apiRouter.use('/reports', reportRouter)
apiRouter.use('/budget-requests', budgetRequestRouter)
apiRouter.use('/budget-returns', budgetReturnRouter)

apiRouter.get('/test', (req, res) => {
   res.json({ ok: true })
})

module.exports = { apiRouter }