'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CalendarDays, Search, X, ArrowUpDown, ArrowUp, ArrowDown,
  Loader2, ChevronLeft, ChevronRight, Download, AlertCircle, Users,
} from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'
import { toast } from 'sonner'

interface DailyRow {
  date: string            // YYYY-MM-DD
  transactions: number
  itemsSold: number
  revenue: number
  avgOrderValue: number
  profit: number
  margin: number          // %
}

type SortField = 'date' | 'transactions' | 'itemsSold' | 'revenue' | 'avgOrderValue' | 'profit' | 'margin'

const PER_PAGE = 10

const peso = (n: number) =>
  `₱${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function prettyDate(iso: string) {
  // iso is YYYY-MM-DD; render in PH locale without timezone shifting
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

interface CashierOption { id: number; email: string }

export default function DailySalesTable({
  cashierId,
  cashiers = [],
  initialFrom = '',
  initialTo = '',
}: {
  cashierId: number | null
  cashiers?: CashierOption[]
  initialFrom?: string
  initialTo?: string
}) {
  const [rows, setRows] = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [cashierFilter, setCashierFilter] = useState<number | null>(cashierId)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  // Keep in sync if the page-level cashier filter changes.
  useEffect(() => { setCashierFilter(cashierId) }, [cashierId])

  // Follow the page-level Period selector (Today/Week/Month/3 months). The
  // user can still override with the date pickers below.
  useEffect(() => { setFrom(initialFrom); setTo(initialTo) }, [initialFrom, initialTo])

  const load = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (cashierFilter) params.set('cashier_id', String(cashierFilter))
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await apiFetch(`/api/reports/daily-sales${qs}`, { headers: apiHeaders(s.token) })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || 'Failed to load daily sales')
      setRows(payload?.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load daily sales')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [cashierFilter, from, to])

  useEffect(() => { void load() }, [load])
  useEffect(() => { setPage(1) }, [search, from, to, cashierFilter, sortField, sortDir])

  const filtered = useMemo(() => {
    let r = [...rows]
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(row => row.date.includes(q) || prettyDate(row.date).toLowerCase().includes(q))
    }
    r.sort((a, b) => {
      const av = a[sortField]
      const bv = b[sortField]
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return r
  }, [rows, search, sortField, sortDir])

  const totals = useMemo(() => ({
    revenue: filtered.reduce((s, r) => s + r.revenue, 0),
    profit: filtered.reduce((s, r) => s + r.profit, 0),
    transactions: filtered.reduce((s, r) => s + r.transactions, 0),
    items: filtered.reduce((s, r) => s + r.itemsSold, 0),
  }), [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const hasFilters = !!(search || from || to || cashierFilter)

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(f); setSortDir('desc') }
  }

  function clearFilters() {
    setSearch(''); setFrom(''); setTo(''); setCashierFilter(null)
  }

  function exportCsv() {
    if (filtered.length === 0) { toast.error('No rows to export.'); return }
    const header = 'Date,Transactions,Items Sold,Revenue,Avg Order,Profit,Margin %\n'
    const body = filtered
      // Date is quoted readable text (e.g. "Jul 02, 2026") so Excel shows it in
      // full instead of squeezing an ISO date into "#######".
      .map(r => `"${prettyDate(r.date)}",${r.transactions},${r.itemsSold},${r.revenue.toFixed(2)},${r.avgOrderValue.toFixed(2)},${r.profit.toFixed(2)},${r.margin}`)
      .join('\n')
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Daily_Sales_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Daily sales exported.')
  }

  const SortHead = ({ field, label, align = 'right' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      {sortField !== field
        ? <ArrowUpDown className="h-3 w-3 opacity-40" />
        : sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
    </button>
  )

  const GRID = 'grid grid-cols-[1.4fr_0.8fr_0.8fr_1fr_1fr_1fr_0.8fr] gap-3 items-center'

  return (
    <Card className="border rounded-2xl shadow-sm bg-card overflow-hidden">
      <CardHeader className="border-b bg-muted/20 flex-row items-center gap-3 space-y-0">
        <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
          <CalendarDays className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base font-bold">Daily Sales</CardTitle>
          <CardDescription>Day-by-day breakdown of revenue, transactions and profit</CardDescription>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={exportCsv}
          disabled={loading || filtered.length === 0}
          className="gap-2 rounded-xl h-9"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-2.5 px-5 py-3 border-b bg-muted/10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search a date (e.g. Jun 11 or 2026-06-11)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-9 h-9 rounded-xl text-sm"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {cashiers.length > 0 && (
              <Select
                value={cashierFilter ? String(cashierFilter) : 'all'}
                onValueChange={v => setCashierFilter(v === 'all' ? null : Number(v))}
              >
                <SelectTrigger className="h-9 w-44 rounded-xl text-xs">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All cashiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cashiers</SelectItem>
                  {cashiers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.email.split('@')[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-9 w-36 rounded-xl text-xs" title="From date" />
            <span className="text-xs text-muted-foreground">→</span>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-9 w-36 rounded-xl text-xs" title="To date" />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 rounded-xl text-xs gap-1 text-rose-600 hover:text-rose-700">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Totals strip */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-2.5 bg-amber-500/[0.04] border-b text-[11px]">
            <span className="text-muted-foreground">Showing <strong className="text-foreground">{filtered.length}</strong> day{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-muted-foreground">Revenue <strong className="text-primary">{peso(totals.revenue)}</strong></span>
            <span className="text-muted-foreground">Profit <strong className="text-emerald-600">{peso(totals.profit)}</strong></span>
            <span className="text-muted-foreground">Transactions <strong className="text-foreground">{totals.transactions.toLocaleString()}</strong></span>
            <span className="text-muted-foreground">Items <strong className="text-foreground">{totals.items.toLocaleString()}</strong></span>
          </div>
        )}

        {/* Header row */}
        <div className={`${GRID} px-5 py-2.5 bg-muted/40 border-b`}>
          <SortHead field="date" label="Date" align="left" />
          <SortHead field="transactions" label="Txns" />
          <SortHead field="itemsSold" label="Items" />
          <SortHead field="revenue" label="Revenue" />
          <SortHead field="avgOrderValue" label="Avg/Order" />
          <SortHead field="profit" label="Profit" />
          <SortHead field="margin" label="Margin" />
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-600" /></div>
        ) : error ? (
          <div className="p-10 text-center text-xs text-rose-600 flex flex-col items-center gap-2">
            <AlertCircle className="h-6 w-6" /> {error}
          </div>
        ) : paged.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <CalendarDays className="h-7 w-7 opacity-30" />
            {hasFilters ? 'No days match your filters.' : 'No sales recorded yet.'}
            {hasFilters && (
              <button onClick={clearFilters} className="text-amber-600 font-semibold hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {paged.map(row => (
              <div key={row.date} className={`${GRID} px-5 py-3 hover:bg-muted/20 transition-colors`}>
                <span className="font-semibold text-sm text-foreground">{prettyDate(row.date)}</span>
                <span className="text-right text-sm">{row.transactions.toLocaleString()}</span>
                <span className="text-right text-sm">{row.itemsSold.toLocaleString()}</span>
                <span className="text-right text-sm font-bold text-primary">{peso(row.revenue)}</span>
                <span className="text-right text-sm text-muted-foreground">{peso(row.avgOrderValue)}</span>
                <span className="text-right text-sm font-semibold text-emerald-600">{peso(row.profit)}</span>
                <span className={`text-right text-sm font-bold ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {row.margin.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && filtered.length > PER_PAGE && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t bg-background">
            <p className="text-[11px] text-muted-foreground">
              <strong>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)}</strong> of <strong>{filtered.length}</strong> days
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] font-semibold px-2">Page {page} / {totalPages}</span>
              <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
