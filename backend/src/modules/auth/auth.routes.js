const { Router } = require('express')

const { requireAuth } = require('../../middleware/auth')
const { authController } = require('./auth.controller')

const authRouter = Router()

authRouter.post('/login', authController.login)
authRouter.get('/me', requireAuth, authController.me)

module.exports = { authRouter }
