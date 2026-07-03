'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  TrendingUp,
  Package,
  AlertCircle,
  PhilippinePeso,
  Users,
  RefreshCw,
  Search,
  CheckCircle2,
  ShoppingCart,
  BarChart3,
  Boxes,
  Wallet,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: number
  name: string
  sku: string
  price: string
  srp_price: string
  quantity: number
  min_stock: number
  profit_per_unit: string
}

interface StockAlert {
  product_id: number
  product_name: string
  quantity: number
  min_stock: number
}

interface CashierAnalytic {
  id: number
  email: string
  total_products: number
  inventory_cost: number
  profit_potential: number
  stock_alerts_count: number
  stock_alerts: StockAlert[]
  products: Product[]
}

interface CashierBudgetStat {
  cashierId: number
  totalRevenue: number
  totalApproved: number
  totalPending: number
  remaining: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string): string {
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getAvatarColor(id: number): string {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ]
  return colors[id % colors.length]
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: 'blue' | 'green' | 'red' | 'gray'
}) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
  }
  const iconBg = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
    gray: 'bg-gray-100 text-gray-600',
  }
  return (
    <Card className={`border ${accentMap[accent].split(' ')[2]}`}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${accentMap[accent].split(' ')[1]}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2.5 ${iconBg[accent]}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function StockProgressBar({ quantity, minStock }: { quantity: number; minStock: number }) {
  const ratio = minStock === 0 ? 100 : Math.min(100, (quantity / minStock) * 100)
  const isLow = quantity < minStock
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress
        value={ratio}
        className={`h-1.5 flex-1 ${isLow ? '[&>div]:bg-red-500' : '[&>div]:bg-emerald-500'}`}
      />
      <span className={`text-xs font-semibold tabular-nums ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
        {quantity}
      </span>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CashierAnalyticsTable({ budgetStats = {} }: { budgetStats?: Record<number, CashierBudgetStat> }) {
  const [analytics, setAnalytics] = useState<CashierAnalytic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCashierId, setSelectedCashierId] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const { toast } = useToast()

  const fetchCashierAnalytics = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true)
      else setIsLoading(true)
      setError(null)

      const session = getAuthSession()
      if (!session?.token) {
        setError('Authentication required')
        toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'destructive' })
        return
      }

      const response = await apiFetch('/api/products/cashiers/analytics', {
        method: 'GET',
        headers: apiHeaders(session.token),
      })

      if (!response.ok) throw new Error(`Failed to fetch analytics: ${response.statusText}`)

      const data = await response.json()

      const normalized: CashierAnalytic[] = (data.data || []).map((c: CashierAnalytic) => ({
        ...c,
        inventory_cost: Number(c.inventory_cost || 0),
        profit_potential: Number(c.profit_potential || 0),
        // Postgres returns COUNT/SUM as strings; coerce so arithmetic doesn't
        // string-concatenate (e.g. 0 + "2125" -> "02125").
        stock_alerts_count: Number(c.stock_alerts_count || 0),
        total_products: Number(c.total_products || 0),
        stock_alerts: c.stock_alerts || [],
        products: c.products || [],
      }))

      setAnalytics(normalized)

      if (showRefresh) toast({ title: 'Data refreshed', description: 'Analytics are up to date.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics'
      setError(message)
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [toast])

  useEffect(() => { fetchCashierAnalytics() }, [fetchCashierAnalytics])

  useEffect(() => {
    if (analytics.length > 0 && selectedCashierId === null) {
      setSelectedCashierId(analytics[0].id)
    }
  }, [analytics, selectedCashierId])

  const selectedCashier = useMemo(
    () => analytics.find((c) => c.id === selectedCashierId) ?? null,
    [analytics, selectedCashierId],
  )

  const filteredProducts = useMemo(() => {
    if (!selectedCashier?.products) return []
    const q = productSearch.toLowerCase()
    if (!q) return selectedCashier.products
    return selectedCashier.products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    )
  }, [selectedCashier, productSearch])

  const totals = useMemo(() => {
    // Count DISTINCT products low on stock (a product assigned to several
    // cashiers should count once), not the sum of per-cashier alert counts.
    const lowStockIds = new Set<number>()
    for (const c of analytics) {
      for (const a of (c.stock_alerts || [])) {
        if (a && typeof a.product_id === 'number') lowStockIds.add(a.product_id)
      }
    }
    return {
      inventoryCost: analytics.reduce((s, c) => s + Number(c.inventory_cost || 0), 0),
      profitPotential: analytics.reduce((s, c) => s + Number(c.profit_potential || 0), 0),
      stockAlerts: lowStockIds.size,
    }
  }, [analytics])

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2 flex items-center gap-4">
          <span>{error}</span>
          <Button onClick={() => fetchCashierAnalytics()} size="sm" variant="outline">
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (analytics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="mt-4 text-base font-semibold text-foreground">No cashiers found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create cashier accounts and assign products to see analytics here.
        </p>
      </div>
    )
  }

  const profitMargin =
    selectedCashier && selectedCashier.inventory_cost > 0
      ? ((selectedCashier.profit_potential / selectedCashier.inventory_cost) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-6">
      {/* ── System-wide Overview ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">System Overview</h2>
            <p className="text-xs text-muted-foreground">Aggregated across all {analytics.length} cashier{analytics.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isRefreshing}
            onClick={() => fetchCashierAnalytics(true)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="Total Cashiers"
            value={String(analytics.length)}
            sub="Active accounts"
            accent="blue"
          />
          <StatCard
            icon={<PhilippinePeso className="h-5 w-5" />}
            label="Inventory Cost"
            value={formatCurrency(totals.inventoryCost)}
            sub="Puhunan sa lahat ng stock"
            accent="gray"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Potential Profit"
            value={formatCurrency(totals.profitPotential)}
            sub="Kita kung mabenta lahat ng stock"
            accent="green"
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Items to Restock"
            value={totals.stockAlerts.toLocaleString()}
            sub={totals.stockAlerts === 0 ? 'Maayos ang lahat ng stock' : 'Mababa na — kailangang mag-restock'}
            accent={totals.stockAlerts > 0 ? 'red' : 'green'}
          />
        </div>
      </section>

      <Separator />

      {/* ── Cashier Selection Row ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Cashier Detailed Analytics</h2>
            <p className="text-xs text-muted-foreground">Choose a cashier to inspect their full performance</p>
          </div>
          <div className="w-full sm:w-72">
            <Select
              value={selectedCashierId?.toString() ?? ''}
              onValueChange={(v) => { setSelectedCashierId(Number(v)); setProductSearch('') }}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select a cashier…" />
              </SelectTrigger>
              <SelectContent>
                {analytics.map((cashier) => (
                  <SelectItem key={cashier.id} value={cashier.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getAvatarColor(cashier.id)}`}
                      >
                        {getInitials(cashier.email)}
                      </span>
                      <span className="truncate">{cashier.email}</span>
                      {cashier.stock_alerts_count > 0 && (
                        <Badge variant="destructive" className="ml-auto shrink-0 text-[10px] px-1.5 py-0">
                          {cashier.stock_alerts_count}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cashier avatar pill buttons – quick jump */}
        <div className="flex flex-wrap gap-2">
          {analytics.map((cashier) => {
            const isSelected = cashier.id === selectedCashierId
            return (
              <button
                key={cashier.id}
                onClick={() => { setSelectedCashierId(cashier.id); setProductSearch('') }}
                className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all
                  ${isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                    : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent'
                  }`}
              >
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                    ${isSelected ? 'bg-white/20 text-white' : getAvatarColor(cashier.id)}`}
                >
                  {getInitials(cashier.email)}
                </span>
                <span className="max-w-[120px] truncate">{cashier.email.split('@')[0]}</span>
                {cashier.stock_alerts_count > 0 && (
                  <span
                    className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold
                      ${isSelected ? 'bg-white text-red-600' : 'bg-red-500 text-white'}`}
                  >
                    {cashier.stock_alerts_count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Selected Cashier Detail Panel ───────────────────────────────────── */}
      {selectedCashier ? (
        <Card className="overflow-hidden border-2 border-border/70 shadow-sm">
          {/* Cashier identity header */}
          <CardHeader className="border-b bg-gradient-to-br from-slate-50 to-blue-50/40 pb-4 pt-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${getAvatarColor(selectedCashier.id)}`}
                >
                  {getInitials(selectedCashier.email)}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Viewing analytics for</p>
                  <h3 className="text-lg font-bold text-foreground">{selectedCashier.email}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedCashier.total_products} products
                    </Badge>
                    {selectedCashier.stock_alerts_count > 0 ? (
                      <Badge variant="destructive" className="text-xs gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {selectedCashier.stock_alerts_count} alert{selectedCashier.stock_alerts_count !== 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Stock healthy
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI chips */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <div className="rounded-lg border bg-white/80 px-3 py-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Inv. Cost</p>
                  <p className="text-base font-bold text-foreground">{formatCurrency(selectedCashier.inventory_cost)}</p>
                </div>
                <div className="rounded-lg border bg-white/80 px-3 py-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Profit</p>
                  <p className="text-base font-bold text-emerald-600">{formatCurrency(selectedCashier.profit_potential)}</p>
                </div>
                <div className="rounded-lg border bg-white/80 px-3 py-2 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Margin</p>
                  <p className="text-base font-bold text-blue-600">{profitMargin}%</p>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Tabbed sections */}
          <CardContent className="p-0">
            <Tabs defaultValue="products" className="w-full">
              <div className="border-b bg-muted/30 px-4 pt-2">
                <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0 gap-1">
                  <TabsTrigger
                    value="products"
                    className="rounded-t-lg rounded-b-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
                  >
                    <Package className="h-4 w-4" />
                    Products
                    <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                      {selectedCashier.total_products}
                    </Badge>
                  </TabsTrigger>

                  <TabsTrigger
                    value="alerts"
                    className="rounded-t-lg rounded-b-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Stock Alerts
                    {selectedCashier.stock_alerts_count > 0 ? (
                      <Badge variant="destructive" className="ml-1.5 text-xs px-1.5">
                        {selectedCashier.stock_alerts_count}
                      </Badge>
                    ) : (
                      <Badge className="ml-1.5 bg-emerald-100 text-emerald-700 text-xs px-1.5">0</Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="financials"
                    className="rounded-t-lg rounded-b-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Financials
                  </TabsTrigger>

                  {budgetStats[selectedCashier.id] && (
                    <TabsTrigger
                      value="budget"
                      className="rounded-t-lg rounded-b-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
                    >
                      <Wallet className="h-4 w-4" />
                      Budget
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              {/* Tab: Products */}
              <TabsContent value="products" className="m-0 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search by name or SKU…"
                      className="pl-9 h-9"
                    />
                  </div>
                  {productSearch && (
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {filteredProducts.length} of {selectedCashier.total_products} shown
                    </p>
                  )}
                </div>

                {filteredProducts.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="font-semibold">SKU</TableHead>
                          <TableHead className="text-right font-semibold">Cost</TableHead>
                          <TableHead className="text-right font-semibold">SRP</TableHead>
                          <TableHead className="text-right font-semibold">Profit/Unit</TableHead>
                          <TableHead className="font-semibold">Stock Level</TableHead>
                          <TableHead className="text-center font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProducts.map((product, i) => {
                          const isLow = product.quantity < product.min_stock
                          return (
                            <TableRow
                              key={product.id}
                              className={`transition-colors ${i % 2 !== 0 ? 'bg-muted/20' : ''} ${isLow ? 'bg-red-50/50 hover:bg-red-50/70' : 'hover:bg-accent/50'}`}
                            >
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>
                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  {product.sku}
                                </code>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(Number(product.price))}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(Number(product.srp_price))}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-bold text-emerald-600 text-sm">
                                  +{formatCurrency(Number(product.profit_per_unit))}
                                </span>
                              </TableCell>
                              <TableCell>
                                <StockProgressBar quantity={product.quantity} minStock={product.min_stock} />
                              </TableCell>
                              <TableCell className="text-center">
                                {isLow ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Low
                                  </Badge>
                                ) : (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
                    <Boxes className="h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-3 text-sm font-medium text-muted-foreground">
                      {productSearch ? 'No products match your search' : 'No products assigned yet'}
                    </p>
                    {productSearch && (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setProductSearch('')}>
                        Clear search
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Tab: Stock Alerts */}
              <TabsContent value="alerts" className="m-0 p-4 space-y-3">
                {selectedCashier.stock_alerts.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                      <p className="text-sm font-medium text-red-800">
                        {selectedCashier.stock_alerts.length} product{selectedCashier.stock_alerts.length !== 1 ? 's are' : ' is'} below minimum stock threshold
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedCashier.stock_alerts.map((alert) => {
                        const shortage = Math.max(0, alert.min_stock - alert.quantity)
                        const ratio = alert.min_stock === 0 ? 0 : Math.min(100, (alert.quantity / alert.min_stock) * 100)
                        return (
                          <div
                            key={alert.product_id}
                            className="rounded-xl border-2 border-red-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="truncate font-semibold text-foreground">{alert.product_name}</p>
                                <div className="mt-3 space-y-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Stock level</span>
                                    <span className="font-medium">{alert.quantity} / {alert.min_stock} min</span>
                                  </div>
                                  <Progress value={ratio} className="h-2 [&>div]:bg-red-500" />
                                  <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Need to restock</span>
                                    <span className="font-bold text-red-600">+{shortage} units</span>
                                  </div>
                                </div>
                              </div>
                              <Badge variant="destructive" className="shrink-0 mt-0.5">Alert</Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 py-12 text-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    <p className="mt-3 text-base font-semibold text-emerald-800">All stock levels healthy</p>
                    <p className="mt-1 text-sm text-emerald-600">Every product is above its minimum stock threshold.</p>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Financials */}
              <TabsContent value="financials" className="m-0 p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-blue-100 bg-blue-50/50">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2.5">
                          <PhilippinePeso className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Total Inventory Cost</p>
                          <p className="text-xl font-bold text-foreground">{formatCurrency(selectedCashier.inventory_cost)}</p>
                          <p className="text-xs text-muted-foreground">Sum of all product costs</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-emerald-100 bg-emerald-50/50">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-100 p-2.5">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Profit Potential</p>
                          <p className="text-xl font-bold text-emerald-600">{formatCurrency(selectedCashier.profit_potential)}</p>
                          <p className="text-xs text-muted-foreground">If all assigned stock sells</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-violet-100 bg-violet-50/50">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-violet-100 p-2.5">
                          <BarChart3 className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Profit Margin</p>
                          <p className="text-xl font-bold text-violet-600">{profitMargin}%</p>
                          <p className="text-xs text-muted-foreground">Profit ÷ Inventory Cost</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-100 bg-amber-50/50">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-amber-100 p-2.5">
                          <ShoppingCart className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Avg Cost / Product</p>
                          <p className="text-xl font-bold text-foreground">
                            {formatCurrency(selectedCashier.inventory_cost / Math.max(1, selectedCashier.total_products))}
                          </p>
                          <p className="text-xs text-muted-foreground">Across {selectedCashier.total_products} items</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedCashier.inventory_cost > 0 && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">Return on Inventory</span>
                      <span className="font-bold text-emerald-600">{profitMargin}%</span>
                    </div>
                    <Progress
                      value={Math.min(100, Number(profitMargin))}
                      className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-emerald-600"
                    />
                    <p className="text-xs text-muted-foreground">
                      For every ₱1 invested, ₱{(Number(profitMargin) / 100 + 1).toFixed(2)} is returned when all stock sells
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Tab: Budget */}
              {budgetStats[selectedCashier.id] && (() => {
                const bs = budgetStats[selectedCashier.id]
                const used = bs.totalApproved + bs.totalPending
                const usedPct = bs.totalRevenue > 0 ? Math.min(100, (used / bs.totalRevenue) * 100) : 0
                const approvedPct = bs.totalRevenue > 0 ? Math.min(100, (bs.totalApproved / bs.totalRevenue) * 100) : 0
                return (
                  <TabsContent value="budget" className="m-0 p-4 space-y-4">
                    {/* Utilization bar */}
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Budget Utilization</p>
                        <span className={`text-sm font-bold ${usedPct >= 100 ? 'text-red-600' : usedPct >= 75 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {usedPct.toFixed(1)}%
                        </span>
                      </div>
                      <Progress
                        value={usedPct}
                        className={`h-3 ${usedPct >= 100 ? '[&>div]:bg-red-500' : usedPct >= 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500'}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(used)} allocated out of {formatCurrency(bs.totalRevenue)} total revenue
                      </p>
                    </div>

                    {/* Budget KPI grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border bg-card p-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(bs.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">All-time sales</p>
                      </div>
                      <div className="rounded-xl border bg-emerald-50/60 p-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Approved Budget</p>
                        <p className="text-xl font-bold text-emerald-600">{formatCurrency(bs.totalApproved)}</p>
                        <p className="text-xs text-muted-foreground">{approvedPct.toFixed(1)}% of revenue</p>
                      </div>
                      <div className="rounded-xl border bg-amber-50/60 p-4 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Pending Requests</p>
                        <p className="text-xl font-bold text-amber-600">{formatCurrency(bs.totalPending)}</p>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                      </div>
                      <div className={`rounded-xl border p-4 space-y-1 ${bs.remaining <= 0 ? 'bg-red-50/60' : 'bg-card'}`}>
                        <p className="text-xs font-medium text-muted-foreground">Remaining Allowance</p>
                        <p className={`text-xl font-bold ${bs.remaining <= 0 ? 'text-red-600' : 'text-foreground'}`}>
                          {formatCurrency(bs.remaining)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {bs.remaining <= 0 ? 'No more budget available' : 'Can still be requested'}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                )
              })()}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">Select a cashier above to view their analytics</p>
          </CardContent>
        </Card>
      )}

      {/* ── All Cashiers Quick Reference ────────────────────────────────────── */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            All Cashiers — Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4 font-semibold">Cashier</TableHead>
                  <TableHead className="text-right font-semibold">Products</TableHead>
                  <TableHead className="text-right font-semibold">Inv. Cost</TableHead>
                  <TableHead className="text-right font-semibold">Profit</TableHead>
                  <TableHead className="text-right font-semibold">Margin</TableHead>
                  <TableHead className="font-semibold">Stock Status</TableHead>
                  <TableHead className="pr-4 text-center font-semibold">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.map((cashier, i) => {
                  const isSelected = cashier.id === selectedCashierId
                  const margin =
                    cashier.inventory_cost > 0
                      ? ((cashier.profit_potential / cashier.inventory_cost) * 100).toFixed(1)
                      : '—'
                  return (
                    <TableRow
                      key={cashier.id}
                      className={`transition-colors ${i % 2 !== 0 ? 'bg-muted/20' : ''} ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-accent/50'}`}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getAvatarColor(cashier.id)}`}
                          >
                            {getInitials(cashier.email)}
                          </span>
                          <span className="font-medium text-sm">{cashier.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">{cashier.total_products}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">{formatCurrency(cashier.inventory_cost)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-emerald-600">
                        {formatCurrency(cashier.profit_potential)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-violet-600">{margin}%</TableCell>
                      <TableCell>
                        {cashier.stock_alerts_count > 0 ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {cashier.stock_alerts_count} alert{cashier.stock_alerts_count !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Healthy
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-center">
                        <Button
                          onClick={() => { setSelectedCashierId(cashier.id); setProductSearch('') }}
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          className="h-7 px-3 text-xs"
                        >
                          {isSelected ? 'Viewing' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
