const { Router } = require('express')
const { requireAuth, requireRole } = require('../../middleware/auth')
const { reportController } = require('./report.controller')

const reportRouter = Router()

reportRouter.use(requireAuth)
reportRouter.use(requireRole('admin'))

reportRouter.get('/sales', reportController.getSalesReport.bind(reportController))
reportRouter.get('/cashier-performance', reportController.getCashierPerformance.bind(reportController))
reportRouter.get('/daily-sales', reportController.getDailySales.bind(reportController))

module.exports = { reportRouter }