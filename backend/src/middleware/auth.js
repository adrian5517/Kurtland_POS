const jwt = require('jsonwebtoken')

const { env } = require('../config/env')
const { HttpError } = require('../utils/http-error')

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase() === 'admin' ? 'admin' : 'cashier'
}

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return next(new HttpError(401, 'Missing access token'))
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret)
    req.user = {
      id: payload.id,
      email: payload.email,
      name: payload.name || null,
      role: normalizeRole(payload.role),
    }
    return next()
  } catch (_error) {
    return next(new HttpError(401, 'Invalid or expired token'))
  }
}

function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new HttpError(401, 'Unauthorized'))
    }

    const role = normalizeRole(req.user.role)
    const permitted = allowedRoles.map(normalizeRole)

    if (!permitted.includes(role)) {
      return next(new HttpError(403, 'You do not have access to this resource'))
    }

    return next()
  }
}

module.exports = { requireAuth, requireRole, normalizeRole }
