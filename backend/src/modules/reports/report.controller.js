const { reportService } = require('./report.service')

class ReportController {
  // Make sure this name is spelled EXACTLY like this
  async getSalesReport(req, res, next) {
    try {
      const { range } = req.query
      const permissibleRanges = ['day', 'week', 'month', '3months']
      const activeRange = permissibleRanges.includes(range) ? range : 'week'

      const reportsData = await reportService.generateSalesReport(activeRange)

      return res.status(200).json({
        success: true,
        data: reportsData
      })
    } catch (error) {
      next(error)
    }
  }
}

// Ensure the export object wrapper matches perfectly
module.exports = { reportController: new ReportController() }