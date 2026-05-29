const bcrypt = require('bcryptjs')

const { HttpError } = require('../../utils/http-error')
const { userRepository } = require('./user.repository')

const VALID_ROLES = ['admin', 'cashier']
const MIN_PASSWORD_LEN = 8

function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    role: user.role,
    isActive: user.is_active,
    createdAt: user.created_at,
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

const userService = {
  async listUsers() {
    const users = await userRepository.findAll()
    return users.map(toSafeUser)
  },

  async createUser({ email, name, password, role }) {
    const trimmedEmail = String(email || '').trim().toLowerCase()
    const trimmedName = String(name || '').trim()

    if (!trimmedEmail || !trimmedName || !password || !role) {
      throw new HttpError(400, 'All fields are required')
    }
    if (!validateEmail(trimmedEmail)) {
      throw new HttpError(400, 'Invalid email format')
    }
    if (!VALID_ROLES.includes(role)) {
      throw new HttpError(400, `Role must be one of: ${VALID_ROLES.join(', ')}`)
    }
    if (String(password).length < MIN_PASSWORD_LEN) {
      throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LEN} characters`)
    }

    const existing = await userRepository.findByEmail(trimmedEmail)
    if (existing) {
      throw new HttpError(409, 'A user with this email already exists')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await userRepository.create({
      email: trimmedEmail,
      name: trimmedName,
      passwordHash,
      role,
    })
    return toSafeUser(user)
  },

  async updateUser(targetId, requesterId, { name, role }) {
    const target = await userRepository.findById(targetId)
    if (!target) throw new HttpError(404, 'User not found')

    if (targetId === requesterId && role !== target.role) {
      throw new HttpError(403, 'You cannot change your own role')
    }

    const trimmedName = String(name || '').trim()
    if (!trimmedName) {
      throw new HttpError(400, 'Name is required')
    }
    if (!VALID_ROLES.includes(role)) {
      throw new HttpError(400, `Role must be one of: ${VALID_ROLES.join(', ')}`)
    }

    const user = await userRepository.update(targetId, { name: trimmedName, role })
    return toSafeUser(user)
  },

  async toggleStatus(targetId, requesterId) {
    if (targetId === requesterId) {
      throw new HttpError(403, 'You cannot deactivate your own account')
    }
    const target = await userRepository.findById(targetId)
    if (!target) throw new HttpError(404, 'User not found')

    const updated = await userRepository.setActiveStatus(targetId, !target.is_active)
    return toSafeUser(updated)
  },

  async resetPassword(targetId, { password }) {
    const trimmedPassword = String(password || '')
    if (trimmedPassword.length < MIN_PASSWORD_LEN) {
      throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LEN} characters`)
    }

    const target = await userRepository.findById(targetId)
    if (!target) throw new HttpError(404, 'User not found')

    const passwordHash = await bcrypt.hash(trimmedPassword, 12)
    await userRepository.updatePassword(targetId, passwordHash)
  },

  async deleteUser(targetId, requesterId) {
    if (targetId === requesterId) {
      throw new HttpError(403, 'You cannot delete your own account')
    }
    const target = await userRepository.findById(targetId)
    if (!target) throw new HttpError(404, 'User not found')

    await userRepository.delete(targetId)
  },

  async updateOwnProfile(requesterId, { name, email }) {
    const trimmedName = String(name || '').trim()
    const trimmedEmail = String(email || '').trim().toLowerCase()

    if (!trimmedName) throw new HttpError(400, 'Name is required')
    if (!trimmedEmail) throw new HttpError(400, 'Email is required')
    if (!validateEmail(trimmedEmail)) throw new HttpError(400, 'Invalid email format')

    const existing = await userRepository.findByEmail(trimmedEmail)
    if (existing && existing.id !== requesterId) {
      throw new HttpError(409, 'Email is already in use by another account')
    }

    const user = await userRepository.updateProfile(requesterId, { name: trimmedName, email: trimmedEmail })
    if (!user) throw new HttpError(404, 'User not found')
    return toSafeUser(user)
  },

  async changeOwnPassword(requesterId, { currentPassword, newPassword }) {
    const hash = await userRepository.getPasswordHash(requesterId)
    if (!hash) throw new HttpError(404, 'User not found')

    const valid = await bcrypt.compare(String(currentPassword || ''), hash)
    if (!valid) throw new HttpError(401, 'Current password is incorrect')

    const trimmedNew = String(newPassword || '')
    if (trimmedNew.length < MIN_PASSWORD_LEN) {
      throw new HttpError(400, `New password must be at least ${MIN_PASSWORD_LEN} characters`)
    }
    if (currentPassword === newPassword) {
      throw new HttpError(400, 'New password must differ from the current password')
    }

    const passwordHash = await bcrypt.hash(trimmedNew, 12)
    await userRepository.updatePassword(requesterId, passwordHash)
  },
}

module.exports = { userService }
