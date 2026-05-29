'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { validateAuthSession } from '@/lib/auth'

// Paths accessible by both admin and cashier roles
const CASHIER_ALLOWED_PATHS = [
  '/dashboard',
  '/dashboard/budget-requests',
  '/dashboard/settings',
]

type DashboardAccessGuardProps = {
  children: ReactNode
}

export default function DashboardAccessGuard({ children }: DashboardAccessGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Validate session (checks token expiration)
    const session = validateAuthSession()

    if (!session?.token) {
      router.replace('/')
      return
    }

    if (session.user.role === 'cashier' && !CASHIER_ALLOWED_PATHS.includes(pathname)) {
      router.replace('/dashboard')
      return
    }

    setReady(true)
  }, [pathname, router])

  if (!ready) {
    return null
  }

  return children
}
