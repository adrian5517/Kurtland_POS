const { budgetRequestService } = require('./budget-request.service')

const budgetRequestController = {
  async list(req, res, next) {
    try {
      const { status } = req.query
      const requests = await budgetRequestService.list(req.user, { status })
      return res.json({ data: requests })
    } catch (error) {
      next(error)
    }
  },

  async create(req, res, next) {
    try {
      const request = await budgetRequestService.create(req.user, req.body)
      return res.status(201).json({ data: request })
    } catch (error) {
      next(error)
    }
  },

  async review(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid request ID' })
      }
      const request = await budgetRequestService.review(id, req.user, req.body)
      return res.json({ data: request })
    } catch (error) {
      next(error)
    }
  },

  async summary(req, res, next) {
    try {
      const data = await budgetRequestService.getSummary()
      return res.json({ data })
    } catch (error) {
      next(error)
    }
  },

  async getMyLimit(req, res, next) {
    try {
      const data = await budgetRequestService.getMyLimit(req.user)
      return res.json({ data })
    } catch (error) {
      next(error)
    }
  },

  async getCashierStats(req, res, next) {
    try {
      const data = await budgetRequestService.getCashierStats()
      return res.json({ data })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { budgetRequestController }
