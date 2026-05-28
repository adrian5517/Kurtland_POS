export type AuthUser = {
  id: number
  email: string
  name: string | null
  role: 'admin' | 'cashier'
}

export type AuthSession = {
  token: string
  user: AuthUser
}

const AUTH_STORAGE_KEY = 'kurtland-auth'

function normalizeRole(role: string | null | undefined): AuthUser['role'] {
  return String(role || '').toLowerCase() === 'admin' ? 'admin' : 'cashier'
}

/**
 * Check if a JWT token is expired
 * Decodes the token payload and compares expiration time
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return true

    const payload = JSON.parse(atob(parts[1]))
    
    // JWT exp is in seconds, Date.now() is in milliseconds
    const expirationTime = (payload.exp || 0) * 1000
    return Date.now() >= expirationTime
  } catch {
    return true // Treat parsing errors as expired
  }
}

/**
 * Validate and return auth session if valid
 * Returns null if session doesn't exist or token is expired
 */
export function validateAuthSession(): AuthSession | null {
  const session = getAuthSession()
  
  if (!session) {
    return null
  }

  // Check if token is expired
  if (isTokenExpired(session.token)) {
    // Clear expired session
    clearAuthSession()
    return null
  }

  return session
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession
    return {
      token: parsed.token,
      user: {
        id: parsed.user.id,
        email: parsed.user.email,
        name: parsed.user.name ?? null,
        role: normalizeRole(parsed.user.role),
      },
    }
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
