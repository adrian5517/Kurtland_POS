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
