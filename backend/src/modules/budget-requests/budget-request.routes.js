const { Router } = require('express')

const { requireAuth, requireRole } = require('../../middleware/auth')
const { budgetRequestController } = require('./budget-request.controller')

const budgetRequestRouter = Router()

budgetRequestRouter.use(requireAuth)

// Both roles: list own (cashier) or all (admin), create request, get summary
budgetRequestRouter.get('/', budgetRequestController.list)
budgetRequestRouter.post('/', budgetRequestController.create)
budgetRequestRouter.get('/summary', budgetRequestController.summary)
budgetRequestRouter.get('/my-limit', budgetRequestController.getMyLimit)

// Admin only: per-cashier budget stats, approve or reject
budgetRequestRouter.get('/cashier-stats', requireRole('admin'), budgetRequestController.getCashierStats)
budgetRequestRouter.patch('/:id/review', requireRole('admin'), budgetRequestController.review)

module.exports = { budgetRequestRouter }
