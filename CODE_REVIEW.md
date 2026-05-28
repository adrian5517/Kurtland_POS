# Code Review: Security, Logic & Production Readiness

## Executive Summary
Your POS system has a **solid foundation** with good architectural patterns (modular structure, proper validation, auth middleware), but has **critical security gaps** and **production-readiness issues** that must be addressed before deployment.

---

## 🚨 CRITICAL SECURITY ISSUES

### 1. **JWT Secret Hardcoded as "dev-secret" in Development**
**File:** `backend/src/config/env.js`
```javascript
jwtSecret: process.env.JWT_SECRET || 'dev-secret', // ⚠️ CRITICAL
```
**Problem:** If production environment variable is missing, it falls back to insecure default.

**Impact:** Any attacker can forge valid JWT tokens.

**Fix:**
```javascript
const env = {
  jwtSecret: process.env.JWT_SECRET,
  // ... other config
}

// Add validation in server startup
if (!env.jwtSecret) {
  console.error('FATAL: JWT_SECRET environment variable is required')
  process.exit(1)
}
```

---

### 2. **JWT Stored in localStorage (XSS Vulnerability)**
**File:** `lib/auth.ts`
```javascript
window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
```
**Problem:** 
- localStorage is vulnerable to XSS attacks
- No httpOnly flag (would require server-side cookie storage)
- Persists indefinitely after logout (manual clearing)

**Impact:** If attacker injects JavaScript via XSS, they can steal the JWT and impersonate any user.

**Fix Options:**
1. **Best:** Use httpOnly, Secure cookies (server-side)
2. **Current Fix (minimum):** Add Content Security Policy (CSP) headers
```javascript
// backend/src/app.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'"], // Prevent inline scripts
      defaultSrc: ["'self'"],
    }
  }
}))
```

---

### 3. **CORS Configuration Too Permissive**
**File:** `backend/src/app.js`
```javascript
app.use(cors()) // ⚠️ Allows ALL origins
```
**Problem:** Accepts requests from any domain.

**Impact:** Enables CSRF attacks and unauthorized cross-origin requests.

**Fix:**
```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))
```

---

### 4. **No CSRF Protection**
**Problem:** Any site can trigger state-changing requests (POST/PUT/DELETE) to your API.

**Impact:** Attackers can create/delete products, process fake orders if user is authenticated.

**Fix:** Add CSRF middleware
```bash
npm install csurf cookie-parser
```
```javascript
const csrf = require('csurf')
const cookieParser = require('cookie-parser')

app.use(cookieParser())
app.use(csrf({ cookie: true }))
app.post('/api/*', (req, res, next) => {
  // CSRF token validation happens here
  next()
})
```

---

### 5. **No Rate Limiting**
**Problem:** API endpoints can be brute-forced or spammed.

**Impact:** 
- Login endpoint vulnerable to brute-force attacks
- API can be DOS'ed
- Database resource exhaustion

**Fix:**
```bash
npm install express-rate-limit
```
```javascript
const rateLimit = require('express-rate-limit')

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, try again later'
})

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100 // 100 requests per minute
})

authRouter.post('/login', authLimiter, authController.login)
app.use('/api', apiLimiter)
```

---

### 6. **No HTTPS Enforcement in Production**
**Problem:** Credentials transmitted over plain HTTP.

**Impact:** Man-in-the-middle attacks can intercept tokens.

**Fix:**
```javascript
// backend/src/app.js - Add only in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(301, `https://${req.header('host')}${req.url}`)
    }
    next()
  })
}
```

---

### 7. **Missing Input Validation on File Uploads**
**File:** `backend/src/modules/uploads/`

**Problem:** No visible validation of uploaded files (type, size, content).

**Impact:** 
- Malware uploads
- Server storage exhaustion
- Arbitrary file execution

**Fix:**
```javascript
const multer = require('multer')
const fileUpload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'))
    }
    cb(null, true)
  }
})
```

---

### 8. **Image URLs Not Sanitized (XSS Risk)**
**File:** `components/inventory/product-form.tsx` and product display

**Problem:** User-provided image URLs displayed directly in HTML.

**Impact:** Attacker can inject `onerror` events or SVG scripts.

**Fix:**
```typescript
// lib/utils.ts
export function sanitizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url)
    // Only allow trusted image CDN domains
    const allowedDomains = ['cloudinary.com', 'cdn.example.com']
    if (!allowedDomains.some(d => parsed.hostname.endsWith(d))) {
      return '/images/placeholder.png'
    }
    return url
  } catch {
    return '/images/placeholder.png'
  }
}
```

---

## 🟡 MODERATE ISSUES

### 9. **SQL Injection Risk in Search/Filter**
**File:** `backend/src/modules/products/product.repository.js` - Line with `LIKE $1`

**Status:** ✅ Currently OK (using parameterized queries)

**Recommendation:** Maintain this pattern everywhere. The `$1`, `$2` syntax is safe.

---

### 10. **No Audit Logging**
**Problem:** No tracking of who did what, when.

**Impact:** 
- No compliance audit trail
- Can't detect insider threats
- Debugging production issues becomes hard

**Fix:** Add audit middleware
```javascript
// backend/src/middleware/audit.js
function auditLog(req, res, next) {
  res.on('finish', () => {
    if (req.user && req.method !== 'GET') {
      console.log({
        timestamp: new Date(),
        user_id: req.user.id,
        action: `${req.method} ${req.path}`,
        status: res.statusCode,
      })
      // In production: save to audit database
    }
  })
  next()
}

app.use(auditLog)
```

---

### 11. **No Request Size Limits**
**File:** `backend/src/app.js`

**Problem:** `express.json()` has default 100kb limit, but could be exhausted.

**Fix:**
```javascript
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb' }))
```

---

### 12. **Weak Error Messages in Production**
**File:** `backend/src/middleware/error-handler.js`
```javascript
return res.status(500).json({ message: 'Internal server error' })
```
**Status:** ✅ Good - doesn't leak details in production.

**Recommendation:** Add error ID for support reference:
```javascript
const errorId = crypto.randomUUID()
console.error(`[${errorId}]`, err)
return res.status(500).json({ 
  message: 'Internal server error',
  errorId // User can reference this to support
})
```

---

### 13. **No Session Expiration on Frontend**
**File:** `lib/auth.ts`

**Problem:** JWT has 12-hour expiration server-side, but frontend doesn't check expiration or refresh.

**Fix:**
```typescript
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() >= payload.exp * 1000
  } catch {
    return true
  }
}

// In your middleware or on app load
export function validateAuthSession(): AuthSession | null {
  const session = getAuthSession()
  if (session && isTokenExpired(session.token)) {
    clearAuthSession()
    return null
  }
  return session
}
```

---

### 14. **No Secrets Validation**
**File:** `backend/src/server.js`

**Problem:** Server starts without validating required environment variables.

**Fix:**
```javascript
const REQUIRED_SECRETS = [
  'JWT_SECRET',
  'DATABASE_URL',
  'NODE_ENV'
]

const missingSecrets = REQUIRED_SECRETS.filter(s => !process.env[s])
if (missingSecrets.length > 0) {
  console.error('Missing required environment variables:', missingSecrets)
  process.exit(1)
}
```

---

## ✅ GOOD APPROACHES (No Changes Needed)

### 1. **Auth Middleware Pattern** ✓
Your `requireAuth` and `requireRole` middleware are well-implemented:
- Consistent error messages (don't leak whether email exists)
- Proper role normalization
- Clean separation of concerns

### 2. **Zod Validation** ✓
Schema validation for all inputs is excellent:
```javascript
const parsed = loginSchema.safeParse(input)
if (!parsed.success) throw new HttpError(400, ...)
```
This prevents malformed data from reaching the database.

### 3. **Parameterized SQL Queries** ✓
All database queries use `$1`, `$2` syntax, preventing SQL injection.

### 4. **Stock Warning Component** ✓
Clean, readable, proper separation of concerns:
- No API calls in component
- Props-based data flow
- Proper error state handling

### 5. **Product Normalization** ✓
The `normalizeProductPayload()` function is sophisticated and handles:
- camelCase/snake_case aliasing
- Type coercion for query strings
- Safe boolean/numeric parsing

---

## 🔴 PRODUCTION-READINESS CHECKLIST

- [ ] Set `JWT_SECRET` environment variable in production
- [ ] Switch from localStorage to httpOnly cookies (or add CSP headers minimum)
- [ ] Configure CORS to specific origins only
- [ ] Add rate limiting to auth endpoints
- [ ] Implement CSRF protection
- [ ] Add file upload validation
- [ ] Sanitize image URLs
- [ ] Enforce HTTPS in production
- [ ] Add audit logging
- [ ] Add request size limits
- [ ] Validate environment variables on startup
- [ ] Add session expiration check on frontend
- [ ] Test with security tools (OWASP ZAP, Burp Suite)
- [ ] Add database connection pooling error handling
- [ ] Set up monitoring/alerting for failed auth attempts
- [ ] Enable SQL query logging in development only
- [ ] Add API documentation with security examples

---

## 🎯 PRIORITY ORDER FOR FIXES

**WEEK 1 (Critical):**
1. Change JWT secret to random value via environment variable
2. Add CORS origin validation
3. Add rate limiting to /auth/login
4. Add file upload validation
5. Add HTTPS redirect in production

**WEEK 2 (Important):**
6. Implement CSRF protection
7. Add audit logging
8. Add session expiration on frontend
9. Validate environment variables on startup
10. Add request size limits

**ONGOING:**
- Add security headers (CSP, X-Frame-Options, etc.)
- Implement database connection health checks
- Add monitoring for suspicious patterns
- Regular dependency security updates

---

## Dependencies to Add

```bash
npm install --save-dev \
  express-rate-limit \
  csurf \
  cookie-parser \
  helmet

# For security scanning during CI/CD
npm install --save-dev \
  snyk \
  npm-audit
```

---

## Testing Security Issues

```bash
# Test CORS
curl -H "Origin: http://evil.com" http://localhost:4000/api/products

# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:4000/api/auth/login; done

# Check headers
curl -I http://localhost:4000/api/products
```

---

## Compliance & Auditing

**For POS systems, consider:**
- PCI DSS compliance (if handling payments)
- GDPR compliance (user data handling)
- Regular penetration testing
- Security audit logs
- Data retention policies

---

## Summary

Your code quality is **good with solid patterns**, but security gaps require immediate attention before any production deployment. The main issues are:

1. Insecure authentication storage (localStorage vs httpOnly cookies)
2. Missing CORS/CSRF protection
3. No rate limiting
4. Unvalidated environment variables

**Estimated effort to fix critical issues: 1-2 days**

Would you like me to implement any of these fixes?
