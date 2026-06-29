'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Download, TrendingUp, DollarSign, ShoppingCart, Percent, Loader2,
  Calendar, AlertCircle, FileText, Search, ArrowUpDown, SlidersHorizontal,
  RefreshCw, CheckCircle2, History, ChevronDown, ChevronUp, Package, Receipt,
  ChevronLeft, ChevronRight, Filter, X, Clock, CheckCircle, PlusCircle,
  MinusCircle, ShoppingBag, CreditCard, Banknote, Hash, Info, Maximize2,
  Minimize2, LayoutTemplate, Columns, SquareArrowOutUpRight, Users, UserCircle,
  BarChart3, Trophy, ArrowRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AggregateSalesRow {
  date: string
  sales: number
  transactions: number
}
interface CategoryRow {
  name: string
  value: number
}
interface BestPerformingProductRow {
  name: string
  sales: number
  revenue: number
}
interface OrderLog {
  id: number
  order_id: number
  action: 'ORDER_CREATED' | 'STOCK_DECREMENTED' | 'CHECKOUT_COMPLETED' | string
  note: string
  created_at: string
  cashier_id?: number
  cashier_email?: string
}

interface GroupedOrder {
  order_id: number
  logs: OrderLog[]
  createdAt: string | null
  checkoutAt: string | null
  status: 'completed' | 'partial' | 'created-only'
  amountPaid: string | null
  change: string | null
  items: { name: string; quantity: string }[]
  allNotes: { action: string; note: string; timestamp: string }[]
  cashierId: number | null
  cashierEmail: string | null
}

interface CashierItem {
  id: number
  email: string
}

interface CashierPerformanceRow {
  cashier_id: number
  cashier_email: string
  revenue: number
  transactions: number
  avg_order_value: number
  profit: number
  sales_margin: number
}

interface ReportPayloadData {
  salesTrend: AggregateSalesRow[]
  categoryDistribution: CategoryRow[]
  topProducts: BestPerformingProductRow[]
  summaryMetrics: {
    revenueGrowthPercentage: number
    overallGrowthPercentage: number
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PALETTE_COLORS = ['#b45309', '#dc2626', '#ea580c', '#d97706', '#f59e0b', '#10b981', '#3b82f6']
const ORDERS_PER_PAGE = 8

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFull(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-PH', {
    weekday: 'short', year: 'numeric', month: 'short',
    day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}
function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
function formatTime(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function parsePayment(note: string) {
  const paid = note.match(/Received:\s*PHP\s*([\d.]+)/i) || note.match(/Paid:\s*₱?\s*([\d.]+)/i)
  const change = note.match(/Change\s*(?:Given)?:\s*PHP\s*([\d.]+)/i) || note.match(/Change:\s*₱?\s*([\d.]+)/i)
  const total = note.match(/Total:\s*(?:PHP|₱)?\s*([\d.]+)/i) || note.match(/Amount:\s*(?:PHP|₱)?\s*([\d.]+)/i)
  return {
    amountPaid: paid ? parseFloat(paid[1]).toFixed(2) : null,
    change: change ? parseFloat(change[1]).toFixed(2) : null,
    total: total ? parseFloat(total[1]).toFixed(2) : null,
  }
}

function parseStockItem(note: string): { name: string; quantity: string } {
  const nameMatch = note.match(/"([^"]+)"/) || note.match(/item\s+([a-zA-Z0-9 \-_]+)/i)
  const qtyMatch = note.match(/quantity\s*([\d]+)/i) || note.match(/by\s*(\d+)/i) || note.match(/x(\d+)/i)
  return {
    name: nameMatch ? nameMatch[1].trim() : 'Unknown item',
    quantity: qtyMatch ? qtyMatch[1] : '1',
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    ORDER_CREATED: 'Order Created',
    STOCK_DECREMENTED: 'Stock Reduced',
    CHECKOUT_COMPLETED: 'Checkout Completed',
  }
  return map[action] ?? action.replace(/_/g, ' ')
}

function actionIcon(action: string) {
  if (action === 'ORDER_CREATED') return PlusCircle
  if (action === 'STOCK_DECREMENTED') return MinusCircle
  if (action === 'CHECKOUT_COMPLETED') return CheckCircle
  return Info
}

function actionColor(action: string) {
  if (action === 'ORDER_CREATED') return 'text-blue-600'
  if (action === 'STOCK_DECREMENTED') return 'text-amber-600'
  if (action === 'CHECKOUT_COMPLETED') return 'text-emerald-600'
  return 'text-muted-foreground'
}

function actionBg(action: string) {
  if (action === 'ORDER_CREATED') return 'bg-blue-500/10 border-blue-500/20'
  if (action === 'STOCK_DECREMENTED') return 'bg-amber-500/10 border-amber-500/20'
  if (action === 'CHECKOUT_COMPLETED') return 'bg-emerald-500/10 border-emerald-500/20'
  return 'bg-muted border-border'
}

function statusBadge(status: GroupedOrder['status']) {
  if (status === 'completed') return { label: 'Completed', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' }
  if (status === 'partial') return { label: 'In Progress', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' }
  return { label: 'Pending', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/30' }
}

function groupLogsByOrder(logs: OrderLog[]): GroupedOrder[] {
  const map = new Map<number, OrderLog[]>()
  for (const log of logs) {
    if (!map.has(log.order_id)) map.set(log.order_id, [])
    map.get(log.order_id)!.push(log)
  }

  const grouped: GroupedOrder[] = []
  map.forEach((orderLogs, order_id) => {
    const sorted = [...orderLogs].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const createdLog = sorted.find(l => l.action === 'ORDER_CREATED')
    const checkoutLog = sorted.find(l => l.action === 'CHECKOUT_COMPLETED')
    const stockLogs = sorted.filter(l => l.action === 'STOCK_DECREMENTED')

    const payment = checkoutLog ? parsePayment(checkoutLog.note) : { amountPaid: null, change: null, total: null }

    const status: GroupedOrder['status'] =
      checkoutLog ? 'completed' : stockLogs.length > 0 ? 'partial' : 'created-only'

    grouped.push({
      order_id,
      logs: sorted,
      createdAt: createdLog?.created_at ?? sorted[0]?.created_at ?? null,
      checkoutAt: checkoutLog?.created_at ?? null,
      status,
      amountPaid: payment.amountPaid,
      change: payment.change,
      items: stockLogs.map(l => parseStockItem(l.note)),
      allNotes: sorted.map(l => ({
        action: l.action,
        note: l.note,
        timestamp: l.created_at,
      })),
      cashierId: sorted[0]?.cashier_id ?? null,
      cashierEmail: sorted[0]?.cashier_email ?? null,
    })
  })

  return grouped.sort((a, b) => b.order_id - a.order_id)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, icon: Icon, value, sub, loading,
}: {
  title: string; icon: React.ElementType; value: string
  sub: React.ReactNode; loading: boolean
}) {
  return (
    <Card className="border shadow-sm bg-card/60 backdrop-blur-sm rounded-2xl hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center justify-between">
          {title}
          <Icon className="h-4 w-4 text-primary" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
          {loading
            ? <span className="inline-block w-28 h-8 rounded-lg bg-muted animate-pulse" />
            : value}
        </p>
        <div className="mt-1.5 text-xs font-medium text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

function ChartSkeleton() {
  return (
    <div className="h-[320px] w-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
      <p className="text-xs font-medium">Loading chart data…</p>
    </div>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[320px] w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <AlertCircle className="h-8 w-8 opacity-30" />
      <p className="text-xs font-medium">{message}</p>
    </div>
  )
}

// ─── Order Detail Card ─────────────────────────────────────────────────────────

function OrderDetailCard({ order, isCentered }: { order: GroupedOrder; isCentered: boolean }) {
  const sb = statusBadge(order.status)

  return (
    <div className={`
      rounded-2xl border bg-background shadow-lg overflow-hidden
      animate-in slide-in-from-top-2 duration-200
      ${isCentered ? 'mx-0 my-0' : 'mt-1 mx-1 mb-3'}
    `}>
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-amber-500/10 to-transparent border-b">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Hash className="h-3.5 w-3.5 text-amber-700" />
          </div>
          <div>
            <span className="font-black text-sm text-foreground font-mono tracking-tight">
              Order #{String(order.order_id).padStart(4, '0')}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {order.logs.length} activity event{order.logs.length !== 1 ? 's' : ''} · {order.items.length} item type{order.items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${sb.cls}`}>
          {sb.label}
        </Badge>
      </div>

      <div className={`p-4 space-y-4 ${isCentered ? 'max-h-[65vh] overflow-y-auto' : ''}`}>

        {/* Row 1: Timestamps */}
        <div className={`grid gap-3 ${isCentered ? 'grid-cols-2' : 'grid-cols-1 xl:grid-cols-2'}`}>
          <div className="rounded-xl border bg-blue-500/5 border-blue-500/20 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              <PlusCircle className="h-3.5 w-3.5" /> Order Opened
            </div>
            {order.createdAt ? (
              <>
                <p className="text-sm font-bold text-foreground">{formatDate(order.createdAt)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {formatTime(order.createdAt)}
                </p>
                <p className="text-[10px] text-blue-600 font-medium bg-blue-500/5 rounded-lg px-2.5 py-1.5 border border-blue-500/10">
                  {formatFull(order.createdAt)}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">No creation record found</p>
            )}
          </div>

          <div className={`rounded-xl border p-4 space-y-2 ${order.checkoutAt
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-muted/30 border-dashed'}`}>
            <div className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${order.checkoutAt ? 'text-emerald-700' : 'text-muted-foreground'}`}>
              <CheckCircle className="h-3.5 w-3.5" /> Checkout Completed
            </div>
            {order.checkoutAt ? (
              <>
                <p className="text-sm font-bold text-foreground">{formatDate(order.checkoutAt)}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> {formatTime(order.checkoutAt)}
                </p>
                <p className="text-[10px] text-emerald-600 font-medium bg-emerald-500/5 rounded-lg px-2.5 py-1.5 border border-emerald-500/10">
                  {formatFull(order.checkoutAt)}
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground italic">Not yet checked out</p>
                <span className="text-[10px] bg-muted rounded-lg px-2.5 py-1.5 border text-muted-foreground">Awaiting payment</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Items + Payment */}
        <div className={`grid gap-3 ${isCentered ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {/* Items */}
          <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                <Package className="h-3.5 w-3.5" /> Items Ordered
              </div>
              {order.items.length > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-500/10 rounded-md px-1.5 py-0.5 border border-amber-500/20">
                  {order.items.reduce((s, i) => s + parseInt(i.quantity), 0)} total units
                </span>
              )}
            </div>
            {order.items.length > 0 ? (
              <div className="space-y-1.5">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-background rounded-xl px-3 py-2.5 border text-xs shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <ShoppingBag className="h-3 w-3 text-amber-600" />
                      </div>
                      <span className="font-semibold text-foreground">{item.name}</span>
                    </div>
                    <span className="font-mono bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-lg font-bold border border-amber-500/20">
                      × {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-background rounded-xl px-3 py-4 border text-center space-y-1">
                <Package className="h-6 w-6 mx-auto opacity-20" />
                <p className="text-xs text-muted-foreground italic">No item details in log</p>
                <p className="text-[10px] text-muted-foreground">Check the Orders section for the full list.</p>
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              <Receipt className="h-3.5 w-3.5" /> Payment Summary
            </div>
            {order.amountPaid || order.change ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-background rounded-xl px-3 py-2.5 border text-xs shadow-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" /> Cash Received
                  </span>
                  <span className="font-mono font-bold text-foreground text-sm">
                    {order.amountPaid ? `₱${order.amountPaid}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-background rounded-xl px-3 py-2.5 border text-xs shadow-sm">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Change Given
                  </span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">
                    {order.change ? `₱${order.change}` : '₱0.00'}
                  </span>
                </div>
                {/* Net total derived */}
                {order.amountPaid && order.change && (
                  <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl px-3 py-2.5 border border-emerald-500/20 text-xs">
                    <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> Order Total
                    </span>
                    <span className="font-mono font-black text-emerald-700 text-sm">
                      ₱{(parseFloat(order.amountPaid) - parseFloat(order.change)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-background rounded-xl px-3 py-4 border text-center space-y-1">
                <CreditCard className="h-6 w-6 mx-auto opacity-20" />
                <p className="text-xs text-muted-foreground italic">
                  {order.status === 'completed'
                    ? 'Payment info not found in log notes.'
                    : 'This order has not been paid yet.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Full activity timeline */}
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-primary" /> Complete Activity Timeline
            </div>
            <span className="text-[10px] font-bold text-muted-foreground bg-background border rounded-lg px-2 py-1">
              {order.allNotes.length} event{order.allNotes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Timeline with vertical connector */}
          <div className="relative">
            {order.allNotes.length > 1 && (
              <div className="absolute left-[18px] top-5 bottom-5 w-px bg-border z-0" />
            )}
            <div className="space-y-2 relative z-10">
              {order.allNotes.map((n, i) => {
                const Icon = actionIcon(n.action)
                const color = actionColor(n.action)
                const bg = actionBg(n.action)
                return (
                  <div key={i} className="flex gap-3">
                    {/* Icon bubble */}
                    <div className={`shrink-0 h-9 w-9 rounded-xl border flex items-center justify-center ${bg} ${color} shadow-sm`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 bg-background rounded-xl p-3 border shadow-sm">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                        <span className={`font-bold text-[11px] uppercase tracking-wide ${color}`}>
                          {actionLabel(n.action)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 bg-muted rounded-md px-1.5 py-0.5">
                          {formatTime(n.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/80 font-normal leading-relaxed break-words">
                        {n.note}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(n.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Centered Modal Overlay ───────────────────────────────────────────────────

function CenteredModal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  // Close on escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', paddingTop: '4vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full flex flex-col bg-background rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200"
        style={{
          maxWidth: '900px',
          height: '92vh',
          margin: '0 16px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Order Activity Log Panel ─────────────────────────────────────────────────

function OrderActivityLog({
  isOpen,
  onClose,
  allGroupedOrders,
  isLogsLoading,
  onRefresh,
  activeFilterLabel,
  inline,
}: {
  isOpen: boolean
  onClose: () => void
  allGroupedOrders: GroupedOrder[]
  isLogsLoading: boolean
  onRefresh: () => void
  activeFilterLabel?: string
  inline?: boolean
}) {
  const [isCentered, setIsCentered] = useState(false)
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'completed' | 'partial' | 'created-only'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => { setCurrentPage(1) }, [searchQuery, selectedStatusFilter, dateFrom, dateTo, sortDirection])

  const filteredOrders = useMemo(() => {
    let result = [...allGroupedOrders]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        String(o.order_id).includes(q) ||
        o.allNotes.some(n => n.note.toLowerCase().includes(q)) ||
        o.items.some(it => it.name.toLowerCase().includes(q))
      )
    }

    if (selectedStatusFilter !== 'ALL') {
      result = result.filter(o => o.status === selectedStatusFilter)
    }

    if (dateFrom) {
      const from = new Date(dateFrom).setHours(0, 0, 0, 0)
      result = result.filter(o => o.createdAt && new Date(o.createdAt).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).setHours(23, 59, 59, 999)
      result = result.filter(o => o.createdAt && new Date(o.createdAt).getTime() <= to)
    }

    result.sort((a, b) => sortDirection === 'desc' ? b.order_id - a.order_id : a.order_id - b.order_id)
    return result
  }, [allGroupedOrders, searchQuery, selectedStatusFilter, dateFrom, dateTo, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE))
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  )

  const hasActiveFilters = searchQuery || selectedStatusFilter !== 'ALL' || dateFrom || dateTo

  function clearFilters() {
    setSearchQuery(''); setSelectedStatusFilter('ALL'); setDateFrom(''); setDateTo('')
  }

  // Stats summary
  const stats = useMemo(() => ({
    completed: allGroupedOrders.filter(o => o.status === 'completed').length,
    partial: allGroupedOrders.filter(o => o.status === 'partial').length,
    pending: allGroupedOrders.filter(o => o.status === 'created-only').length,
  }), [allGroupedOrders])

  const PanelContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-amber-500/5 to-transparent shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/25">
            <ShoppingBag className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">Order Activity Log</h2>
            <p className="text-[11px] text-muted-foreground">All orders grouped with full details</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Refresh */}
          <Button
            variant="ghost" size="icon"
            onClick={onRefresh}
            disabled={isLogsLoading}
            className="h-8 w-8 rounded-xl"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLogsLoading ? 'animate-spin' : ''}`} />
          </Button>
          {/* Center/Expand toggle — hidden in inline mode */}
          {!inline && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCentered(p => !p)}
              className={`gap-1.5 rounded-xl text-xs font-semibold h-8 px-3 transition-all ${
                isCentered
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 hover:bg-amber-500/20'
                  : 'hover:bg-muted'
              }`}
              title={isCentered ? 'Switch to side panel view' : 'Switch to centered modal view'}
            >
              {isCentered
                ? <><Columns className="h-3.5 w-3.5" /> Side Panel</>
                : <><Maximize2 className="h-3.5 w-3.5" /> Center View</>
              }
            </Button>
          )}
          {/* Close — hidden in inline mode */}
          {!inline && (
            <Button
              variant="ghost" size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 bg-muted/30 border-b shrink-0 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium">Quick stats:</span>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <span className="text-[11px] font-bold bg-background border rounded-lg px-2 py-0.5 text-foreground">
            {allGroupedOrders.length} total
          </span>
          <span className="text-[11px] font-bold bg-emerald-500/10 border-emerald-500/20 border rounded-lg px-2 py-0.5 text-emerald-700">
            ✓ {stats.completed} completed
          </span>
          <span className="text-[11px] font-bold bg-amber-500/10 border-amber-500/20 border rounded-lg px-2 py-0.5 text-amber-700">
            ⚡ {stats.partial} in progress
          </span>
          <span className="text-[11px] font-bold bg-blue-500/10 border-blue-500/20 border rounded-lg px-2 py-0.5 text-blue-700">
            + {stats.pending} pending
          </span>
        </div>
        {activeFilterLabel && (
          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1 shrink-0">
            <UserCircle className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-bold text-primary">{activeFilterLabel}</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 space-y-2.5 border-b bg-muted/10 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by order #, item name, or note…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-9 bg-background rounded-xl text-sm border h-9 focus-visible:ring-1 focus-visible:ring-amber-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {([
              { value: 'ALL', label: 'All' },
              { value: 'completed', label: '✓ Completed' },
              { value: 'partial', label: '⚡ In Progress' },
              { value: 'created-only', label: '+ Pending' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setSelectedStatusFilter(value)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  selectedStatusFilter === value
                    ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                    : 'bg-background hover:bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Date range */}
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-background rounded-xl text-xs border h-8 w-32 focus-visible:ring-1 focus-visible:ring-amber-500"
              title="From date"
            />
            <span className="text-[11px] text-muted-foreground">→</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-background rounded-xl text-xs border h-8 w-32 focus-visible:ring-1 focus-visible:ring-amber-500"
              title="To date"
            />
            {/* Sort toggle */}
            <button
              onClick={() => setSortDirection(p => p === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-background border rounded-xl px-2.5 py-1.5 hover:bg-muted transition-all h-8 shrink-0"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortDirection === 'desc' ? 'Newest' : 'Oldest'}
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
          >
            <X className="h-3 w-3" /> Clear all filters
            {filteredOrders.length !== allGroupedOrders.length && (
              <span className="ml-1 text-muted-foreground font-normal">({filteredOrders.length} of {allGroupedOrders.length} shown)</span>
            )}
          </button>
        )}
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* Column headers */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-5 py-2.5 bg-muted/40 border-b text-[11px] font-bold text-muted-foreground uppercase tracking-wider select-none shrink-0">
          <span className="w-5" />
          <span>Order Details</span>
          <span className="text-center">Status</span>
          <span className="text-right">Date & Time</span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 divide-y">
          {isLogsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin text-amber-600" />
              <p className="text-sm font-medium">Loading orders…</p>
            </div>
          ) : paginatedOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Filter className="h-8 w-8 opacity-25" />
              <p className="text-sm font-semibold">No orders match your filters</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-amber-600 text-xs font-semibold hover:underline mt-1">
                  Clear filters to see all orders
                </button>
              )}
            </div>
          ) : (
            paginatedOrders.map(order => {
              const isExpanded = expandedOrderId === order.order_id
              const sb = statusBadge(order.status)
              return (
                <div key={order.order_id}>
                  {/* Summary Row */}
                  <div
                    onClick={() => setExpandedOrderId(p => p === order.order_id ? null : order.order_id)}
                    className={`grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-5 py-3.5 cursor-pointer hover:bg-muted/40 transition-colors ${isExpanded ? 'bg-amber-500/[0.04]' : ''}`}
                  >
                    <div className={`transition-all duration-200 ${isExpanded ? 'text-amber-600 rotate-0' : 'text-muted-foreground'}`}>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4" />
                        : <ChevronDown className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground font-mono">
                          Order #{String(order.order_id).padStart(4, '0')}
                        </span>
                        <span className="text-[10px] text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 border">
                          {order.logs.length} event{order.logs.length !== 1 ? 's' : ''}
                        </span>
                        {order.cashierEmail && (
                          <span className="text-[10px] font-semibold text-primary/80 bg-primary/5 border border-primary/15 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                            <UserCircle className="h-2.5 w-2.5" />
                            {order.cashierEmail.split('@')[0]}
                          </span>
                        )}
                      </div>
                      {order.items.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {order.items.map(it => `${it.name} ×${it.quantity}`).join(', ')}
                        </p>
                      )}
                      {order.amountPaid && (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                          <Banknote className="h-3 w-3" />
                          Cash ₱{order.amountPaid} · Change ₱{order.change ?? '0.00'}
                        </p>
                      )}
                    </div>

                    <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${sb.cls}`}>
                      {sb.label}
                    </Badge>

                    {order.createdAt && (
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-semibold text-foreground/80 font-mono whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-0.5 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatTime(order.createdAt)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded detail — inline when side panel, modal when centered */}
                  {isExpanded && !isCentered && (
                    <div className="px-3 pb-2">
                      <OrderDetailCard order={order} isCentered={false} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        <div className="border-t bg-background px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-muted-foreground font-medium">
            {filteredOrders.length === 0
              ? 'No orders found'
              : <>
                  <strong>{(currentPage - 1) * ORDERS_PER_PAGE + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)}</strong>
                  {' '}of <strong>{filteredOrders.length}</strong> orders
                  {hasActiveFilters && <span className="text-muted-foreground"> (of {allGroupedOrders.length} total)</span>}
                </>
            }
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon" className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page = i + 1
              if (totalPages > 5) {
                if (currentPage <= 3) page = i + 1
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                else page = currentPage - 2 + i
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 rounded-lg text-[11px] font-semibold transition-all ${
                    currentPage === page
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-background border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {page}
                </button>
              )
            })}
            <Button
              variant="outline" size="icon" className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon" className="h-7 w-7 rounded-lg"
              onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Centered expanded order detail — modal within modal */}
      {isCentered && expandedOrderId !== null && (() => {
        const order = allGroupedOrders.find(o => o.order_id === expandedOrderId)
        if (!order) return null
        return (
          <div
            className="fixed inset-0 z-[110] flex items-start justify-center bg-black/50 backdrop-blur-sm"
            style={{ paddingTop: '5vh' }}
            onClick={() => setExpandedOrderId(null)}
          >
            <div
              className="w-full bg-background rounded-2xl shadow-2xl border overflow-hidden animate-in zoom-in-95 slide-in-from-top-4 duration-200 flex flex-col"
              style={{ maxWidth: '760px', maxHeight: '88vh', margin: '0 16px' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Detail modal header */}
              <div className="flex items-center justify-between px-5 py-3 border-b bg-gradient-to-r from-amber-500/10 to-transparent shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-black font-mono text-sm">
                    Order #{String(order.order_id).padStart(4, '0')} — Full Details
                  </span>
                </div>
                <button
                  onClick={() => setExpandedOrderId(null)}
                  className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <OrderDetailCard order={order} isCentered={true} />
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )

  // Inline mode — render directly without any drawer or modal wrapper
  if (inline) {
    return (
      <div className="rounded-2xl border bg-card overflow-hidden" style={{ minHeight: '600px' }}>
        <PanelContent />
      </div>
    )
  }

  // Render as side drawer or centered modal
  if (isCentered) {
    return (
      <CenteredModal isOpen={isOpen} onClose={onClose}>
        <PanelContent />
      </CenteredModal>
    )
  }

  // Side drawer
  if (!isOpen) return null
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col w-screen sm:w-[92vw] lg:w-[860px] max-w-none bg-background border-l shadow-2xl animate-in slide-in-from-right duration-300 h-screen">
        <PanelContent />
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | '3months'>('week')
  const [reportData, setReportData] = useState<ReportPayloadData | null>(null)
  const [logsData, setLogsData] = useState<OrderLog[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isLogsLoading, setIsLogsLoading] = useState(false)
  const [errorContext, setErrorContext] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'orders'>('overview')

  // ── Cashier filter state ─────────────────────────────────────────────────
  const [cashiers, setCashiers] = useState<CashierItem[]>([])
  const [selectedCashierId, setSelectedCashierId] = useState<number | null>(null)
  const [cashierPerformance, setCashierPerformance] = useState<CashierPerformanceRow[]>([])
  const [isCashierPerfLoading, setIsCashierPerfLoading] = useState(false)

  const selectedCashier = useMemo(
    () => cashiers.find(c => c.id === selectedCashierId) ?? null,
    [cashiers, selectedCashierId]
  )

  const session = useMemo(() => {
    if (typeof window === 'undefined') return null
    return getAuthSession()
  }, [])
  const isAdmin = session?.user?.role === 'admin'

  const loadReportData = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token) {
      setErrorContext('You are not logged in. Please sign in to view reports.')
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setErrorContext(null)
    try {
      const cashierParam = selectedCashierId ? `&cashier_id=${selectedCashierId}` : ''
      const res = await apiFetch(`/api/reports/sales?range=${timeRange}${cashierParam}`, {
        method: 'GET',
        headers: apiHeaders(s.token),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.message || 'Could not load sales data.')
      setReportData(payload?.data ?? null)
    } catch (err) {
      setErrorContext(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setReportData(null)
    } finally {
      setIsLoading(false)
    }
  }, [timeRange, selectedCashierId])

  const loadOrderLogs = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token) return
    setIsLogsLoading(true)
    try {
      const cashierParam = selectedCashierId ? `?cashier_id=${selectedCashierId}` : ''
      const res = await apiFetch(`/api/orders/logs${cashierParam}`, { method: 'GET', headers: apiHeaders(s.token) })
      const payload = await res.json()
      if (res.ok) setLogsData(payload?.data ?? [])
    } catch {
      toast.error('Could not load activity logs. Please refresh.')
    } finally {
      setIsLogsLoading(false)
    }
  }, [selectedCashierId])

  const loadCashiers = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token || s.user?.role !== 'admin') return
    try {
      const res = await apiFetch('/api/products/cashiers/list', { method: 'GET', headers: apiHeaders(s.token) })
      if (res.ok) {
        const payload = await res.json()
        setCashiers(payload?.data ?? [])
      }
    } catch {
      // Non-critical — cashier filter just won't populate
    }
  }, [])

  const loadCashierPerformance = useCallback(async () => {
    const s = getAuthSession()
    if (!s?.token || s.user?.role !== 'admin') return
    setIsCashierPerfLoading(true)
    try {
      const res = await apiFetch(`/api/reports/cashier-performance?range=${timeRange}`, {
        method: 'GET',
        headers: apiHeaders(s.token),
      })
      if (res.ok) {
        const payload = await res.json()
        setCashierPerformance(payload?.data ?? [])
      }
    } catch {
      // Non-critical — summary just won't show
    } finally {
      setIsCashierPerfLoading(false)
    }
  }, [timeRange])

  useEffect(() => {
    void loadReportData()
    void loadOrderLogs()
  }, [loadReportData, loadOrderLogs])

  useEffect(() => {
    void loadCashiers()
  }, [loadCashiers])

  useEffect(() => {
    if (isAdmin) void loadCashierPerformance()
  }, [loadCashierPerformance, isAdmin])

  const computedMetrics = useMemo(() => {
    const trends = reportData?.salesTrend ?? []
    const totalRevenue = trends.reduce((s, r) => s + (Number(r.sales) || 0), 0)
    const totalTransactions = trends.reduce((s, r) => s + (Number(r.transactions) || 0), 0)
    const avgTransaction = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0
    const bestDay = trends.length > 0
      ? trends.reduce((max, r) => (r.sales > max.sales ? r : max), trends[0])
      : { date: '—', sales: 0 }
    return { totalRevenue, totalTransactions, avgTransaction, bestDay }
  }, [reportData])

  const allGroupedOrders = useMemo(() => groupLogsByOrder(logsData), [logsData])

  const timeRangeLabel = useMemo(() => ({
    day: 'Today', week: 'This Week', month: 'This Month', '3months': 'Last 3 Months',
  } as const)[timeRange], [timeRange])

  const refreshAll = useCallback(() => {
    void loadReportData()
    void loadOrderLogs()
    if (isAdmin) void loadCashierPerformance()
  }, [loadReportData, loadOrderLogs, loadCashierPerformance, isAdmin])

  const handleExportData = async () => {
    if (!reportData || reportData.salesTrend.length === 0) {
      toast.error('No data available to export.')
      return
    }
    setIsExporting(true)
    try {
      const header = 'Date,Gross Revenue (PHP),Transaction Count\n'
      const rows = reportData.salesTrend
        .map(r => `"${r.date.replace(/"/g, '""')}",${r.sales},${r.transactions}`)
        .join('\n')
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cashierSuffix = selectedCashier ? `_${selectedCashier.email.split('@')[0]}` : ''
      a.download = `Sales_Report_${timeRange}${cashierSuffix}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report exported successfully!')
    } catch {
      toast.error('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  const growth = reportData?.summaryMetrics?.revenueGrowthPercentage ?? 0
  const overall = reportData?.summaryMetrics?.overallGrowthPercentage ?? 0

  return (
    <div className="w-full max-w-none animate-in fade-in duration-300">

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b pb-5 mb-6">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Sales & Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {selectedCashier
              ? `Viewing: ${selectedCashier.email} · ${timeRangeLabel}`
              : `All cashiers · ${timeRangeLabel}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={refreshAll}
            disabled={isLoading || isLogsLoading}
            className="gap-2 rounded-xl h-9 px-4"
          >
            <RefreshCw className={`h-4 w-4 ${(isLoading || isLogsLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleExportData}
            disabled={isLoading || !!errorContext || isExporting}
            size="sm"
            className="gap-2 rounded-xl h-9 px-4"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* ── Unified Filter Bar ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4 mb-6 shadow-sm">
        {/* Row 1: Time Period */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-14 shrink-0">Period</span>
          <div className="flex flex-wrap gap-1.5 bg-muted/60 border p-1 rounded-xl shadow-inner">
            {([
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: '3months', label: 'Last 3 Months' },
            ] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === value
                    ? 'bg-background text-foreground shadow-sm border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg border">
            <Calendar className="h-3 w-3 text-primary" />
            <span>Live data</span>
            {(isLoading || isLogsLoading) && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>
        </div>

        {/* Row 2: Cashier Filter (admin only) */}
        {isAdmin && (cashiers.length > 0 || isCashierPerfLoading) && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider w-14 shrink-0 flex items-center gap-1">
              <Users className="h-3 w-3" /> Cashier
            </span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              <button
                onClick={() => setSelectedCashierId(null)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                  selectedCashierId === null
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                All
              </button>
              {cashiers.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCashierId(c.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                    selectedCashierId === c.id
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <UserCircle className="h-3 w-3" />
                  {c.email.split('@')[0]}
                </button>
              ))}
            </div>
            {selectedCashierId && (
              <button
                onClick={() => setSelectedCashierId(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────── */}
      {errorContext && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-3 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="text-xs mt-0.5 opacity-80">{errorContext}</p>
          </div>
          <button onClick={loadReportData} className="ml-auto text-xs font-semibold underline underline-offset-2 shrink-0">
            Try again
          </button>
        </div>
      )}

      {/* ── Main Navigation Tabs ─────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full sm:w-auto mb-6 h-auto p-1 gap-1 rounded-2xl">
          <TabsTrigger value="overview" className="gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="performance" className="gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm">
              <Trophy className="h-3.5 w-3.5" />
              Cashier Performance
              {cashierPerformance.length > 0 && (
                <span className="ml-1 text-[10px] font-bold bg-amber-500/20 text-amber-700 rounded-md px-1.5 py-0.5">
                  {cashierPerformance.length}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="orders" className="gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold data-[state=active]:shadow-sm">
            <History className="h-3.5 w-3.5" />
            Order History
            {allGroupedOrders.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-background border rounded-md px-1.5 py-0.5 text-foreground">
                {allGroupedOrders.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0 focus-visible:ring-0 focus-visible:outline-none">

          {/* KPI Cards */}
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title={selectedCashier ? `${selectedCashier.email.split('@')[0]}'s Revenue` : 'Total Revenue'}
              icon={DollarSign} loading={isLoading}
              value={`₱${computedMetrics.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              sub={<span className={`font-semibold ${growth >= 0 ? 'text-green-600' : 'text-rose-600'}`}>
                {growth >= 0 ? '+' : ''}{growth}% vs previous period
              </span>}
            />
            <StatCard
              title={selectedCashier ? `${selectedCashier.email.split('@')[0]}'s Transactions` : 'Total Transactions'}
              icon={ShoppingCart} loading={isLoading}
              value={computedMetrics.totalTransactions.toLocaleString()}
              sub={<>Average order: <span className="font-bold text-foreground">₱{computedMetrics.avgTransaction.toLocaleString()}</span></>}
            />
            <StatCard
              title="Best Sales Day" icon={TrendingUp} loading={isLoading}
              value={`₱${computedMetrics.bestDay.sales.toLocaleString()}`}
              sub={<>Date: <span className="font-bold text-primary">{computedMetrics.bestDay.date}</span></>}
            />
            <StatCard
              title="Overall Growth" icon={Percent} loading={isLoading}
              value={`${overall}%`}
              sub={<span className="text-green-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Business performing well
              </span>}
            />
          </div>

          {/* Charts */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border rounded-2xl col-span-1 lg:col-span-2 shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base font-bold">Revenue Over Time</CardTitle>
                <CardDescription>
                  {selectedCashier ? `${selectedCashier.email}'s sales — ` : 'All cashiers · '}Daily totals for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? <ChartSkeleton /> : (!reportData || reportData.salesTrend.length === 0) ? (
                  <EmptyChart message="No sales data for this period." />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={reportData.salesTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₱${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }}
                        formatter={(v: any) => [`₱${Number(v).toLocaleString()}`, 'Revenue']}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#b45309" strokeWidth={3} name="Daily Revenue" dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border rounded-2xl shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base font-bold">Sales by Category</CardTitle>
                <CardDescription>
                  {selectedCashier ? `${selectedCashier.email.split('@')[0]}'s product mix` : 'Which product categories are selling the most'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 flex items-center justify-center">
                {isLoading ? <ChartSkeleton /> : (!reportData || reportData.categoryDistribution.length === 0) ? (
                  <EmptyChart message="No category data available." />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={reportData.categoryDistribution}
                        cx="50%" cy="50%" labelLine outerRadius={95}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        dataKey="value"
                      >
                        {reportData.categoryDistribution.map((_, i) => (
                          <Cell key={i} fill={PALETTE_COLORS[i % PALETTE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => `₱${Number(v).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border rounded-2xl shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base font-bold">Daily Transaction Count</CardTitle>
                <CardDescription>How many orders were processed each day</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoading ? <ChartSkeleton /> : (!reportData || reportData.salesTrend.length === 0) ? (
                  <EmptyChart message="No transaction data available." />
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={reportData.salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)', borderRadius: '12px' }} />
                      <Bar dataKey="transactions" fill="#ea580c" name="Orders" radius={[6, 6, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Products */}
          <Card className="border rounded-2xl shadow-sm bg-card overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <CardTitle className="text-base font-bold">Top Selling Products</CardTitle>
              <CardDescription>
                {selectedCashier ? `${selectedCashier.email.split('@')[0]}'s best products by revenue` : 'Best performers ranked by total revenue generated'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
              ) : (!reportData || reportData.topProducts.length === 0) ? (
                <div className="p-12 text-center text-xs text-muted-foreground">No products sold in this period yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {reportData.topProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 px-6 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex h-7 w-7 items-center justify-center text-xs font-black rounded-lg border ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-700 border-amber-500/30' :
                          idx === 1 ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' :
                          idx === 2 ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                          'bg-primary/10 text-primary border-primary/20'
                        }`}>{idx + 1}</span>
                        <div>
                          <p className="font-bold text-sm text-foreground">{product.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {product.sales.toLocaleString()} {product.sales === 1 ? 'unit' : 'units'} sold
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-sm text-primary">
                          ₱{product.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground bg-muted border px-2 py-0.5 rounded-md mt-0.5">
                          {computedMetrics.totalRevenue > 0
                            ? ((product.revenue / computedMetrics.totalRevenue) * 100).toFixed(1)
                            : 0}% of total revenue
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        {/* ── Cashier Performance Tab (admin only) ─────────────────────── */}
        {isAdmin && (
          <TabsContent value="performance" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
            <Card className="border rounded-2xl shadow-sm bg-card overflow-hidden">
              <CardHeader className="border-b bg-muted/20 flex-row items-center gap-3 space-y-0">
                <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Trophy className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base font-bold">Cashier Performance Summary</CardTitle>
                  <CardDescription>
                    Revenue & transactions per cashier for {timeRangeLabel.toLowerCase()}
                  </CardDescription>
                </div>
                {isCashierPerfLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardHeader>
              <CardContent className="p-0">
                {isCashierPerfLoading ? (
                  <div className="p-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-amber-600" />
                  </div>
                ) : cashierPerformance.length === 0 ? (
                  <div className="p-10 text-center text-xs text-muted-foreground">
                    No cashier transaction data found for this period.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 px-6 py-2.5 bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <span className="w-6" />
                      <span>Cashier</span>
                      <span className="text-right w-28">Revenue</span>
                      <span className="text-right w-24">Transactions</span>
                      <span className="text-right w-24">Avg / Order</span>
                      <span className="text-right w-24">Sales Margin</span>
                    </div>
                    {cashierPerformance.map((row, idx) => {
                      const totalRevenue = cashierPerformance.reduce((s, r) => s + r.revenue, 0)
                      const share = totalRevenue > 0 ? ((row.revenue / totalRevenue) * 100).toFixed(1) : '0.0'
                      return (
                        <div key={row.cashier_id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-3 items-center px-6 py-4 hover:bg-muted/20 transition-colors group">
                          <span className={`inline-flex h-7 w-7 items-center justify-center text-xs font-black rounded-xl border ${
                            idx === 0 ? 'bg-amber-500/20 text-amber-700 border-amber-500/30' :
                            idx === 1 ? 'bg-slate-500/10 text-slate-600 border-slate-500/20' :
                            idx === 2 ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                            'bg-muted text-muted-foreground border-border'
                          }`}>{idx + 1}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <UserCircle className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-foreground truncate">{row.cashier_email.split('@')[0]}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{row.cashier_email}</p>
                              </div>
                              <button
                                onClick={() => { setSelectedCashierId(row.cashier_id); setActiveTab('overview') }}
                                className="ml-2 text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 hover:underline"
                              >
                                View charts <ArrowRight className="h-2.5 w-2.5" />
                              </button>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{share}% share</span>
                            </div>
                          </div>
                          <span className="text-right font-extrabold text-sm text-primary w-28">
                            ₱{row.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-right font-bold text-sm text-foreground w-24">
                            {row.transactions.toLocaleString()}
                          </span>
                          <span className="text-right font-semibold text-sm text-muted-foreground w-24">
                            ₱{row.avg_order_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-right w-24">
                            <span className={`font-bold text-sm ${row.sales_margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {row.sales_margin.toFixed(1)}%
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              ₱{row.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Order History Tab ─────────────────────────────────────────── */}
        <TabsContent value="orders" className="mt-0 focus-visible:ring-0 focus-visible:outline-none">
          <OrderActivityLog
            isOpen={true}
            onClose={() => {}}
            allGroupedOrders={allGroupedOrders}
            isLogsLoading={isLogsLoading}
            onRefresh={loadOrderLogs}
            activeFilterLabel={selectedCashier ? `Filtered: ${selectedCashier.email}` : undefined}
            inline={true}
          />
        </TabsContent>

      </Tabs>
    </div>
  )
}