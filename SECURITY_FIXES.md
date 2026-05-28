# Security Fixes & Setup Guide

## ✅ Implemented Security Fixes

### 1. **Environment Variable Validation** ✅
- **File:** `backend/src/config/env.js`
- **Fix:** Server now fails to start if required env vars are missing
- **Required Variables:**
  - `JWT_SECRET` - Random secret for signing JWTs (generate with `openssl rand -base64 32`)
  - `DATABASE_URL` - PostgreSQL connection string

### 2. **Enhanced Security Headers** ✅
- **File:** `backend/src/app.js`
- **Implements:**
  - Content Security Policy (CSP) - Prevents inline scripts/XSS
  - HSTS - Forces HTTPS in production
  - X-Frame-Options - Prevents clickjacking
  - Referrer Policy - Strict no-referrer

### 3. **CORS Configuration** ✅
- **File:** `backend/src/app.js`
- **Fix:** Only allows specified origins (set via `CORS_ORIGIN` env var)
- **Format:** Comma-separated list
- **Example:** `CORS_ORIGIN=http://localhost:3000,https://yourdomain.com`

### 4. **Rate Limiting** ✅
- **File:** `backend/src/app.js`
- **Implemented:**
  - General API: 100 requests/minute
  - Login endpoint: 5 attempts/15 minutes
- **Prevents:** Brute-force attacks, API enumeration

### 5. **CSRF Protection** ✅
- **File:** `backend/src/app.js`
- **Middleware:** csurf token validation
- **Status:** Cookie-based CSRF tokens enabled

### 6. **File Upload Validation** ✅
- **File:** `backend/src/middleware/file-upload.js`
- **Validates:**
  - File type: JPEG, PNG, WebP only
  - File size: Max 5MB
  - Filename: Sanitized (no special chars, no traversal attacks)

### 7. **Audit Logging** ✅
- **File:** `backend/src/middleware/audit.js`
- **Logs:** All state-changing operations (POST, PUT, DELETE)
- **Includes:** User ID, IP address, timestamp, action, status
- **Note:** Set up audit database in production

### 8. **Request Size Limits** ✅
- **File:** `backend/src/app.js`
- **Limits:** JSON/URL-encoded bodies to 10MB

### 9. **HTTPS Redirect (Production)** ✅
- **File:** `backend/src/app.js`
- **Behavior:** Automatically redirects HTTP to HTTPS in production

### 10. **Token Expiration Check** ✅
- **File:** `lib/auth.ts`
- **New Functions:**
  - `isTokenExpired()` - Checks if JWT is expired
  - `validateAuthSession()` - Returns null if expired
- **Usage:** Updated DashboardAccessGuard to use this

### 11. **Image URL Sanitization** ✅
- **File:** `lib/utils.ts`
- **New Function:** `sanitizeImageUrl()`
- **Prevents:** XSS attacks via malicious image URLs
- **Whitelist:** Cloudinary, trusted CDNs only

### 12. **Error Handling Improvements** ✅
- **File:** `backend/src/middleware/error-handler.js`
- **Improvement:** Error IDs for support reference
- **Benefit:** User can reference error ID, server logs are hidden

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
npm install
```

### Step 2: Configure Environment Variables

**Backend (.env):**
```bash
# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Create .env file with:
PORT=4000
DATABASE_URL=postgresql://user:password@localhost:5432/db_name
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Step 3: Verify Environment Variables

Before starting the server, verify that:
1. `JWT_SECRET` is set and is a strong random value
2. `DATABASE_URL` is valid and database exists
3. `CORS_ORIGIN` matches your frontend domain

### Step 4: Start Development Servers

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
npm run dev
```

---

## 🔐 Production Deployment Checklist

- [ ] Generate strong `JWT_SECRET`: `openssl rand -base64 32`
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to your domain only
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure database with strong credentials
- [ ] Enable audit logging to database
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Enable database backups
- [ ] Set up rate limiting with Redis (optional, for distributed systems)
- [ ] Configure Content Security Policy headers
- [ ] Test all security headers with: `curl -I https://yourdomain.com/api/products`
- [ ] Run OWASP ZAP security scan
- [ ] Enable Web Application Firewall (WAF) on CDN/proxy

---

## 🧪 Testing Security Fixes

### Test CORS Validation
```bash
# Should fail (cross-origin not allowed)
curl -H "Origin: http://evil.com" http://localhost:4000/api/products

# Should succeed (allowed origin)
curl -H "Origin: http://localhost:3000" http://localhost:4000/api/products
```

### Test Rate Limiting
```bash
# Should hit rate limit after 5 attempts
for i in {1..10}; do 
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### Test File Upload Validation
```bash
# Should fail (invalid type)
curl -X POST http://localhost:4000/api/uploads/image \
  -F "image=@test.exe" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should succeed (valid type)
curl -X POST http://localhost:4000/api/uploads/image \
  -F "image=@test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Security Headers
```bash
curl -I http://localhost:4000/api/products

# Look for these headers:
# Content-Security-Policy
# Strict-Transport-Security
# X-Content-Type-Options
# X-Frame-Options
# Referrer-Policy
```

### Test Token Expiration
```bash
# Frontend automatically clears expired tokens
# You can test by:
# 1. Login to get a token
# 2. Wait for token to expire (JWT set to 12 hours)
# 3. Try to access protected route
# 4. Should redirect to login
```

---

## 📋 Remaining TODOs for Production

### High Priority
- [ ] Set up Redis for distributed rate limiting
- [ ] Implement token refresh mechanism (optional, for longer sessions)
- [ ] Set up database audit table for persistent audit logs
- [ ] Configure email notifications for suspicious activities
- [ ] Set up automated backups

### Medium Priority
- [ ] Implement API key authentication for service-to-service calls
- [ ] Add request signing for sensitive operations
- [ ] Set up request/response logging for compliance
- [ ] Implement account lockout after failed logins
- [ ] Add 2FA support

### Low Priority
- [ ] Implement API versioning for backwards compatibility
- [ ] Add request throttling per user (currently per IP)
- [ ] Set up security scanning in CI/CD pipeline
- [ ] Implement database encryption at rest

---

## 🔗 Environment Variables Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@localhost/db` | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Random 32 chars | Use `openssl rand -base64 32` |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Comma-separated allowed origins |
| `NODE_ENV` | No | `production` | Enables HTTPS redirect & CSP |
| `PORT` | No | `4000` | Server port |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:4000` | Frontend API base URL |

---

## 📚 Security References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)

---

## 🆘 Troubleshooting

### Server won't start: "Missing required environment variables"
- **Solution:** Verify `JWT_SECRET` and `DATABASE_URL` are set in `.env`

### CORS errors in browser console
- **Solution:** Check `CORS_ORIGIN` matches your frontend domain exactly
- **Format:** http://localhost:3000 (not https on localhost)

### File uploads fail with "Invalid file type"
- **Solution:** Only JPEG, PNG, WebP allowed; max 5MB
- **Filename:** Must not contain special characters

### Rate limiting blocks legitimate requests
- **Solution:** Increase limits in `backend/src/app.js` if needed
- **Note:** Different limits per endpoint (auth: 5/15min, API: 100/min)

### Token expiration issues
- **Solution:** Frontend automatically redirects expired tokens to login
- **Note:** JWT expires after 12 hours
- **Development:** Can manually clear localStorage to test
