const { reportRepository } = require('./report.repository')

class ReportService {
  _getRangeConfig(range) {
    switch (range) {
      case 'day':     return { intervalDays: '1',  bucketUnit: 'hour', dateSymbols: 'HH24:00' }
      case 'month':   return { intervalDays: '30', bucketUnit: 'day',  dateSymbols: 'Mon DD' }
      case '3months': return { intervalDays: '90', bucketUnit: 'week', dateSymbols: 'WW (Mon)' }
      default:        return { intervalDays: '7',  bucketUnit: 'day',  dateSymbols: 'Mon DD' }
    }
  }

  async generateSalesReport(range, cashierId = null) {
    const { intervalDays, bucketUnit, dateSymbols } = this._getRangeConfig(range)
    return await reportRepository.getSalesData(intervalDays, bucketUnit, dateSymbols, cashierId)
  }

  async getCashierPerformance(range) {
    const { intervalDays } = this._getRangeConfig(range)
    return await reportRepository.getCashierPerformance(intervalDays)
  }
}

module.exports = { reportService: new ReportService() }