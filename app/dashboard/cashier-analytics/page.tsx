'use client'

import { useEffect, useState } from 'react'
import { getAuthSession } from '@/lib/auth'
import { CashierAnalyticsTable } from '@/components/inventory/cashier-analytics-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, BarChart3, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function CashierAnalyticsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const session = getAuthSession()
    const adminStatus = session?.user?.role === 'admin'
    setIsAdmin(adminStatus)
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="w-full max-w-none space-y-6 animate-in fade-in duration-300">
        <div className="h-12 w-64 rounded-lg bg-muted animate-pulse" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="w-full max-w-none">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            You don't have permission to view this page. Admin access required.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-7 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary" />
              Cashier Analytics
            </div>
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor cashier performance, inventory costs, profit potential, and stock levels across all cashiers.
          </p>
        </div>
      </div>

      {/* ── Analytics Dashboard ── */}
      <div className="w-full">
        <CashierAnalyticsTable />
      </div>
    </div>
  )
}
