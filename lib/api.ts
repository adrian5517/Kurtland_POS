export function apiUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export function apiHeaders(token?: string) {
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), init)
}
