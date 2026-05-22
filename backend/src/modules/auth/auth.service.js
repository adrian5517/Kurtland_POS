const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const { env } = require('../../config/env')
const { HttpError } = require('../../utils/http-error')
const { normalizeRole } = require('../../middleware/auth')
const { loginSchema } = require('./auth.schema')
const { authRepository } = require('./auth.repository')

function toSafeUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: normalizeRole(user.role),
  }
}

const authService = {
  async login(input) {
    const parsed = loginSchema.safeParse(input)

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid login payload')
    }

    const user = await authRepository.findUserByEmail(parsed.data.email)

    if (!user) {
      throw new HttpError(401, 'Invalid email or password')
    }

    const isValid = await bcrypt.compare(parsed.data.password, user.password_hash)

    if (!isValid) {
      throw new HttpError(401, 'Invalid email or password')
    }

    const safeUser = toSafeUser(user)
    const token = jwt.sign(safeUser, env.jwtSecret, { expiresIn: '12h' })

    return {
      user: safeUser,
      token,
    }
  },

  async me(userId) {
    const user = await authRepository.findUserById(userId)

    if (!user) {
      throw new HttpError(404, 'User not found')
    }

    return toSafeUser(user)
  },
}

module.exports = { authService }
