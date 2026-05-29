const { budgetReturnService } = require('./budget-return.service')

const budgetReturnController = {
  async list(req, res, next) {
    try {
      const { status } = req.query
      const returns = await budgetReturnService.list(req.user, { status })
      return res.json({ data: returns })
    } catch (error) {
      next(error)
    }
  },

  async create(req, res, next) {
    try {
      const ret = await budgetReturnService.create(req.user, req.body)
      return res.status(201).json({ data: ret })
    } catch (error) {
      next(error)
    }
  },

  async review(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid return ID' })
      }
      const ret = await budgetReturnService.review(id, req.user, req.body)
      return res.json({ data: ret })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { budgetReturnController }
