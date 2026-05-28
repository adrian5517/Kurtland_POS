const crypto = require('crypto')
const { HttpError } = require('../utils/http-error')

function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'Route not found'))
}

function errorHandler(err, _req, res, _next) {
  const errorId = crypto.randomUUID()

  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ 
      message: err.message,
      errorId 
    })
  }

  // Log unexpected errors with ID for support reference
  console.error(`[ERROR_ID: ${errorId}]`, err)
  
  return res.status(500).json({ 
    message: 'Internal server error',
    errorId // User can reference this to support
  })
}

module.exports = {
  notFoundHandler,
  errorHandler,
}