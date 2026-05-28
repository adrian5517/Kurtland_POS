/**
 * Audit Logging Middleware
 * 
 * Logs all state-changing requests (POST, PUT, DELETE) for security auditing.
 * Includes: timestamp, user ID, action, IP address, status code.
 */

function auditLog(req, res, next) {
  // Only audit state-changing operations
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next()
  }

  // Capture response finish to log status code
  res.on('finish', () => {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      userId: req.user?.id || 'anonymous',
      userEmail: req.user?.email || 'anonymous',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    }

    // Log to console (in production, send to audit database/service)
    if (res.statusCode >= 400) {
      console.warn('⚠️  [AUDIT] Failed operation:', auditEntry)
    } else {
      console.log('✓ [AUDIT] Operation logged:', auditEntry)
    }

    // TODO: In production, persist to audit database:
    // await auditRepository.log(auditEntry)
  })

  next()
}

module.exports = { auditLog }
