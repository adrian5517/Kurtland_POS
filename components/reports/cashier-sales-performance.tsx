'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  PhilippinePeso, TrendingUp, TrendingDown, ShoppingCart, RefreshCw,
  Loader2, AlertCircle, UserCircle, Trophy,
} from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

type Range = 'day' | 'week' | 'month' | '3months'

interface Row {
  cashier_id: number
  cashier_email: string
  revenue: number
  transactions: number
  avg_order_value: number
  profit: number
  sales_margin: number
}

const RANGES: { value: Range; label: string }[] = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: 'Last 3 Months' },
]

const peso = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n || 0)

export function CashierSalesPerformance() {
  const [range, setRange] = useState<Range>('day')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/reports/cashier-performance?range=${range}`, { headers: apiHeaders(s.token) })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || 'Failed to load sales performance')
      setRows((payload?.data ?? []) as Row[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sales performance')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  const totals = useMemo(() => ({
    revenue: rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0),
    profit: rows.reduce((s, r) => s + (Number(r.profit) || 0), 0),
    transactions: rows.reduce((s, r) => s + (Number(r.transactions) || 0), 0),
  }), [rows])

  const rangeLabel = RANGES.find(r => r.value === range)?.label ?? ''
  const sorted = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue), [rows])
  const maxRevenue = sorted[0]?.revenue || 0

  return (
    <Card className="rounded-2xl border shadow-sm overflow-hidden">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
              <PhilippinePeso className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base font-bold">Kita at Tubo — Sales per Cashier</CardTitle>
              <CardDescription>Actual revenue &amp; profit from completed sales · {rangeLabel}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex flex-wrap gap-1 bg-muted/60 border p-1 rounded-xl">
              {RANGES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setRange(value)}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all ${
                    range === value
                      ? 'bg-background text-foreground shadow-sm border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={load} disabled={loading} className="h-9 w-9 rounded-xl shrink-0" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Totals */}
        <div className="grid grid-cols-3 divide-x border-b">
          <div className="p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Kita</p>
            <p className="text-lg sm:text-xl font-black text-primary mt-1 tabular-nums">{peso(totals.revenue)}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Tubo</p>
            <p className={`text-lg sm:text-xl font-black mt-1 tabular-nums ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{peso(totals.profit)}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transactions</p>
            <p className="text-lg sm:text-xl font-black text-foreground mt-1 tabular-nums">{totals.transactions.toLocaleString()}</p>
          </div>
        </div>

        {/* Per-cashier list */}
        {loading ? (
          <div className="p-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" /></div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-600 flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" /> {error}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <PhilippinePeso className="h-8 w-8 opacity-30" />
            Walang benta sa {rangeLabel.toLowerCase()} pa.
          </div>
        ) : (
          <div className="divide-y">
            {sorted.map((r, idx) => {
              const share = maxRevenue > 0 ? (r.revenue / maxRevenue) * 100 : 0
              return (
                <div key={r.cashier_id} className="flex flex-col gap-2.5 p-4 hover:bg-muted/20 transition-colors sm:flex-row sm:items-center">
                  {/* Rank + cashier */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`inline-flex h-7 w-7 items-center justify-center text-xs font-black rounded-xl border shrink-0 ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-700 border-amber-500/30'
                      : idx === 1 ? 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                      : idx === 2 ? 'bg-orange-500/10 text-orange-700 border-orange-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {idx === 0 ? <Trophy className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <UserCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{r.cashier_email.split('@')[0]}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{r.cashier_email}</p>
                      {/* Revenue share bar */}
                      <div className="mt-1.5 h-1.5 w-full max-w-[220px] rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-5 sm:w-auto pl-10 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kita</p>
                      <p className="text-sm font-extrabold text-primary tabular-nums">{peso(r.revenue)}</p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tubo</p>
                      <p className={`text-sm font-extrabold tabular-nums flex items-center gap-1 sm:justify-end ${r.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {r.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {peso(r.profit)}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Orders</p>
                      <p className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1 sm:justify-end">
                        <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                        {r.transactions.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
