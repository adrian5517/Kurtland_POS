const { reportRepository } = require('./report.repository')

class ReportService {
  async generateSalesReport(range) {
    let intervalDays = '7'
    let bucketUnit = 'day'
    let dateSymbols = 'Mon DD'

    // Secure mapping configurations
    switch (range) {
      case 'day':
        intervalDays = '1'
        bucketUnit = 'hour'
        dateSymbols = 'HH24:00'
        break
      case 'month':
        intervalDays = '30'
        bucketUnit = 'day'
        dateSymbols = 'Mon DD'
        break
      case '3months':
        intervalDays = '90'
        bucketUnit = 'week'
        dateSymbols = 'WW (Mon)'
        break
      case 'week':
      default:
        intervalDays = '7'
        bucketUnit = 'day'
        dateSymbols = 'Mon DD'
        break
    }

    return await reportRepository.getSalesData(intervalDays, bucketUnit, dateSymbols)
  }
}

module.exports = { reportService: new ReportService() }