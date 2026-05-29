const { Router } = require('express')

const { requireAuth, requireRole } = require('../../middleware/auth')
const { userController } = require('./user.controller')

const userRouter = Router()

const adminOnly = [requireAuth, requireRole('admin')]

// Any authenticated user: change own password / update own profile (must come before /:id routes)
userRouter.patch('/me/password', requireAuth, userController.changeOwnPassword)
userRouter.patch('/me', requireAuth, userController.updateOwnProfile)

// Admin-only: manage all users
userRouter.get('/', ...adminOnly, userController.list)
userRouter.post('/', ...adminOnly, userController.create)
userRouter.put('/:id', ...adminOnly, userController.update)
userRouter.patch('/:id/status', ...adminOnly, userController.toggleStatus)
userRouter.patch('/:id/password', ...adminOnly, userController.resetPassword)
userRouter.delete('/:id', ...adminOnly, userController.deleteUser)

module.exports = { userRouter }
