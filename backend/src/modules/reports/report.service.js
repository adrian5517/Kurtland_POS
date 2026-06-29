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

  async getDailySales({ cashierId = null, from = null, to = null } = {}) {
    const rows = await reportRepository.getDailySales({ cashierId, from, to })
    return rows.map((r) => {
      const revenue = Number(r.revenue) || 0
      const profit = Number(r.profit) || 0
      const transactions = Number(r.transactions) || 0
      return {
        date: r.day,
        transactions,
        itemsSold: Number(r.items_sold) || 0,
        revenue,
        avgOrderValue: transactions > 0 ? revenue / transactions : 0,
        profit,
        margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
      }
    })
  }
}

module.exports = { reportService: new ReportService() }