const { reportService } = require('./report.service')

class ReportController {
  async getSalesReport(req, res, next) {
    try {
      const { range, cashier_id } = req.query
      const permissibleRanges = ['day', 'week', 'month', '3months']
      const activeRange = permissibleRanges.includes(range) ? range : 'week'
      // Validate cashier_id: positive integer only, never trust raw string
      const cashierId = cashier_id && /^\d+$/.test(cashier_id) ? parseInt(cashier_id, 10) : null

      const reportsData = await reportService.generateSalesReport(activeRange, cashierId)
      return res.status(200).json({ success: true, data: reportsData })
    } catch (error) {
      next(error)
    }
  }

  async getCashierPerformance(req, res, next) {
    try {
      const { range } = req.query
      const permissibleRanges = ['day', 'week', 'month', '3months']
      const activeRange = permissibleRanges.includes(range) ? range : 'week'
      const data = await reportService.getCashierPerformance(activeRange)
      return res.status(200).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }
}

module.exports = { reportController: new ReportController() }