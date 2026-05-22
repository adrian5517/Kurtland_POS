const { Router } = require('express')

const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kurtland-backend' })
})

module.exports = { healthRouter }