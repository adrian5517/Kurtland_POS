'use client'

import { useEffect, useState } from 'react'
import { getAuthSession } from '@/lib/auth'
import { apiFetch, apiHeaders } from '@/lib/api'
import { CashierAnalyticsTable } from '@/components/inventory/cashier-analytics-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, BarChart3, AlertCircle, Wallet, TrendingDown, Clock, ChevronRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

type BudgetSummary = {
  pending: number
  approved: number
  totalApprovedAmount: number
  totalRevenue: number
  netRevenue: number
}

type CashierBudgetStat = {
  cashierId: number
  totalRevenue: number
  totalApproved: number
  totalPending: number
  remaining: number
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

export default function CashierAnalyticsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [token, setToken] = useState('')
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [budgetStatsMap, setBudgetStatsMap] = useState<Record<number, CashierBudgetStat>>({})

  useEffect(() => {
    const session = getAuthSession()
    const adminStatus = session?.user?.role === 'admin'
    setIsAdmin(adminStatus)
    setToken(session?.token ?? '')
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!token || !isAdmin) return
    Promise.all([
      apiFetch('/api/budget-requests/summary', { headers: apiHeaders(token) }).then((r) => r.json()),
      apiFetch('/api/budget-requests/cashier-stats', { headers: apiHeaders(token) }).then((r) => r.json()),
    ])
      .then(([summaryData, statsData]) => {
        setBudgetSummary(summaryData.data)
        const map: Record<number, CashierBudgetStat> = {}
        for (const s of (statsData.data ?? []) as CashierBudgetStat[]) map[s.cashierId] = s
        setBudgetStatsMap(map)
      })
      .catch(() => null)
  }, [token, isAdmin])

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

      {/* ── Budget Overview ── */}
      {budgetSummary && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" />
                Budget Requests Overview
              </CardTitle>
              <Link href="/dashboard/budget-requests">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Manage <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pending</p>
                </div>
                <p className="text-2xl font-bold text-amber-600">{budgetSummary.pending}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Allocated</p>
                </div>
                <p className="text-base font-bold text-emerald-600 truncate">{fmt(budgetSummary.totalApprovedAmount)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 border border-border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Revenue</p>
                </div>
                <p className="text-base font-bold text-foreground truncate">{fmt(budgetSummary.totalRevenue)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 border border-border p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Net</p>
                </div>
                <p className={`text-base font-bold truncate ${budgetSummary.netRevenue < 0 ? 'text-red-600' : 'text-foreground'}`}>
                  {fmt(budgetSummary.netRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Analytics Dashboard ── */}
      <div className="w-full">
        <CashierAnalyticsTable budgetStats={budgetStatsMap} />
      </div>
    </div>
  )
}
