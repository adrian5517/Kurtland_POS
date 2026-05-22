const { Router } = require('express')

const { requireAuth, requireRole } = require('../../middleware/auth')
const { productController } = require('./product.controller')

const productRouter = Router()

productRouter.use(requireAuth)
productRouter.get('/', productController.index)
productRouter.post('/', requireRole('admin'), productController.store)
productRouter.put('/:id', requireRole('admin'), productController.update)
productRouter.delete('/:id', requireRole('admin'), productController.destroy)

module.exports = { productRouter }