const { userService } = require('./user.service')

const userController = {
  async list(req, res, next) {
    try {
      const users = await userService.listUsers()
      return res.json({ data: users })
    } catch (error) {
      next(error)
    }
  },

  async create(req, res, next) {
    try {
      const user = await userService.createUser(req.body)
      return res.status(201).json({ data: user })
    } catch (error) {
      next(error)
    }
  },

  async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid user ID' })
      }
      const user = await userService.updateUser(id, req.user.id, req.body)
      return res.json({ data: user })
    } catch (error) {
      next(error)
    }
  },

  async toggleStatus(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid user ID' })
      }
      const user = await userService.toggleStatus(id, req.user.id)
      return res.json({ data: user })
    } catch (error) {
      next(error)
    }
  },

  async resetPassword(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid user ID' })
      }
      await userService.resetPassword(id, req.body)
      return res.json({ message: 'Password reset successfully' })
    } catch (error) {
      next(error)
    }
  },

  async deleteUser(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: 'Invalid user ID' })
      }
      await userService.deleteUser(id, req.user.id)
      return res.status(204).send()
    } catch (error) {
      next(error)
    }
  },

  async changeOwnPassword(req, res, next) {
    try {
      await userService.changeOwnPassword(req.user.id, req.body)
      return res.json({ message: 'Password changed successfully' })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { userController }
