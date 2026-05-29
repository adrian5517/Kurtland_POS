const { Router } = require('express')
const { requireAuth, requireRole } = require('../../middleware/auth')
const { budgetReturnController } = require('./budget-return.controller')

const budgetReturnRouter = Router()

budgetReturnRouter.use(requireAuth)

// Cashier: list own returns, submit a return
// Admin: list all returns
budgetReturnRouter.get('/', budgetReturnController.list)
budgetReturnRouter.post('/', budgetReturnController.create)

// Admin only: approve or reject a return
budgetReturnRouter.patch('/:id/review', requireRole('admin'), budgetReturnController.review)

module.exports = { budgetReturnRouter }
