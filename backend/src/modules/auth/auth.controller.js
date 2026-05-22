const { authService } = require('./auth.service')

const authController = {
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body)
      return res.json({ data: result })
    } catch (error) {
      next(error)
    }
  },

  async me(req, res, next) {
    try {
      const user = await authService.me(req.user.id)
      return res.json({ data: user })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { authController }
