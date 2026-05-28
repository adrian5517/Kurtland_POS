const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const csrf = require('csurf')
const rateLimit = require('express-rate-limit')

const { apiRouter } = require('./routes')
const { errorHandler, notFoundHandler } = require('./middleware/error-handler')
const { auditLog } = require('./middleware/audit')
const { env } = require('./config/env')

const app = express()

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:'],
      fontSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}))

// ─── HTTPS Redirect (Production Only) ───────────────────────────────────────
if (env.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`)
    }
    next()
  })
}

// ─── CORS Configuration ──────────────────────────────────────────────────────
const corsOrigins = env.corsOrigin.split(',').map(o => o.trim())
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}))

// ─── Request Body Limits ────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

// ─── Cookie & CSRF Protection ───────────────────────────────────────────────
app.use(cookieParser())
// Apply CSRF only to non-API routes (API uses JWT tokens instead)
app.use((req, res, next) => {
  // Skip CSRF for: API routes, OPTIONS requests, GET requests
  if (req.path.startsWith('/api') || req.method === 'OPTIONS' || req.method === 'GET') {
    return next()
  }
  csrf({ cookie: false, sessionKey: 'csrf-token' })(req, res, next)
})

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(morgan('dev'))

// ─── Audit Logging (Security Audits) ──────────────────────────────────────────
app.use(auditLog)

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful attempts
})

// Apply rate limiting
app.use('/api/', generalLimiter)
app.use('/api/auth/login', authLimiter)

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use('/api', apiRouter)

// ─── Error Handlers ─────────────────────────────────────────────────────────
app.use(notFoundHandler)
app.use(errorHandler)

module.exports = { app }