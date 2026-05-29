const { Router } = require('express')

// NOTE: For test automation we temporarily allow unauthenticated product creation.
// Remove or revert this change in production. Auth middleware is defined in middleware/auth.js
const { requireAuth, requireRole } = require('../../middleware/auth')
const { productController } = require('./product.controller')

const productRouter = Router()

productRouter.use(requireAuth)

// Product distribution routes (admin only) - must come before /:id routes
productRouter.get('/cashiers/list', requireRole('admin'), productController.getCashiers)
productRouter.get('/cashiers/analytics', requireRole('admin'), productController.getCashierAnalytics)

// General product routes
productRouter.get('/', productController.index)
productRouter.post('/', requireRole('admin'), productController.store)
productRouter.put('/:id', requireRole('admin'), productController.update)
productRouter.delete('/:id', requireRole('admin'), productController.destroy)
productRouter.get('/:id/cashiers', requireRole('admin'), productController.getCashiersForProduct)
productRouter.post('/:id/assign-cashiers', requireRole('admin'), productController.assignProductToCashiers)
productRouter.delete('/:id/cashiers/:cashierId', requireRole('admin'), productController.removeSingleCashier)

module.exports = { productRouter }