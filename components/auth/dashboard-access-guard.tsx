'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'

type DashboardAccessGuardProps = {
  children: ReactNode
}

export default function DashboardAccessGuard({ children }: DashboardAccessGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const session = getAuthSession()

    if (!session?.token) {
      router.replace('/')
      return
    }

    if (session.user.role === 'cashier' && pathname !== '/dashboard') {
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
