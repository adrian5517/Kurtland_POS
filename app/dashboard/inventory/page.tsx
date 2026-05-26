'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Plus, Edit2, Trash2, Search, Package, AlertTriangle, Layers, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown,
  ArrowUp, ArrowDown, Filter, RefreshCw, TrendingDown, ShieldAlert,
  CheckCircle2, SlidersHorizontal, EyeOff, Eye
} from 'lucide-react'
import ProductForm from '@/components/inventory/product-form'
import ProductEditForm from '@/components/inventory/product-edit-form'
import StockWarning from '@/components/inventory/stock-warning'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiProduct = {
  id: number
  name: string
  sku: string
  category: string
  price: string
  srp_price: string
  quantity: number
  is_active: boolean
  profit?: string | number
  profit_margin?: string | number
  image_url: string | null
  image_public_id: string | null
}

type InventoryItem = {
  id: string
  code: string
  name: string
  category: string
  minStock: number
  minPrice: number
  maxPrice: number
  srpPrice: number
  isActive: boolean
  currentStock: number
  profit: number
  profitMargin: number
  image: string | null
  imagePublicId: string | null
}

type SortField = 'name' | 'code' | 'category' | 'currentStock' | 'minPrice' | 'srpPrice'
type SortDir = 'asc' | 'desc'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapProduct(product: ApiProduct): InventoryItem {
  const price = Number(product.price) || 0
  const srpPrice = Number(product.srp_price) || 0
  const profit = Number(product.profit) || srpPrice - price
  const profitMargin = Number(product.profit_margin) || (srpPrice > 0 ? (profit / srpPrice) * 100 : 0)
  return {
    id: String(product.id),
    code: product.sku || '',
    name: product.name || 'Unnamed Product',
    category: product.category || 'Products',
    minStock: 5,
    minPrice: price,
    maxPrice: price,
    srpPrice: srpPrice,
    isActive: product.is_active ?? true,
    currentStock: product.quantity || 0,
    profit,
    profitMargin,
    image: product.image_url,
    imagePublicId: product.image_public_id,
  }
}

function stockStatus(item: InventoryItem) {
  if (item.currentStock === 0) return 'out' as const
  if (item.currentStock <= item.minStock) return 'low' as const
  return 'stable' as const
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string; value: string; icon: React.ElementType
  color: 'primary' | 'destructive' | 'green'; loading: boolean
}) {
  const colorMap = {
    primary: {
      bg: 'bg-primary/10',
      text: 'text-primary',
      value: 'text-foreground',
    },
    destructive: {
      bg: 'bg-destructive/10',
      text: 'text-destructive',
      value: 'text-destructive',
    },
    green: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      value: 'text-emerald-600 dark:text-emerald-400',
    },
  }
  const c = colorMap[color]

  return (
    <Card className="border rounded-2xl shadow-sm bg-card/60 backdrop-blur-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${c.bg} shrink-0`}>
          <Icon className={`h-5 w-5 ${c.text}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {loading
            ? <div className="h-8 w-20 bg-muted animate-pulse rounded-lg mt-1" />
            : <p className={`text-2xl font-black tracking-tight mt-0.5 ${c.value}`}>{value}</p>
          }
        </div>
      </CardContent>
    </Card>
  )
}

function SortButton({
  field, label, sortField, sortDir, onSort,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = sortField === field
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-1 group transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
      <span className="ml-0.5">
        {active
          ? sortDir === 'asc'
            ? <ArrowUp className="h-3 w-3" />
            : <ArrowDown className="h-3 w-3" />
          : <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        }
      </span>
    </button>
  )
}

function StatusBadge({ status, isActive }: { status: 'stable' | 'low' | 'out'; isActive: boolean }) {
  if (!isActive) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 text-[11px] font-bold uppercase tracking-wide">
      <EyeOff className="h-3 w-3" />
      Inactive
    </span>
  )

  if (status === 'out') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px] font-bold uppercase tracking-wide">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
      Out
    </span>
  )
  if (status === 'low') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-bold uppercase tracking-wide">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
      Low
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-wide">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
      OK
    </span>
  )
}

function StockBar({ current, min }: { current: number; min: number }) {
  const max = Math.max(min * 3, current, 1)
  const pct = Math.min((current / max) * 100, 100)
  const color = current === 0 ? 'bg-red-500' : current <= min ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono font-semibold tabular-nums text-foreground">{current}</span>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  // Derive admin status from the auth session role field.
  // Adjust the role string(s) to match your actual auth payload.
  const isAdmin = useMemo(() => {
    const session = getAuthSession()
    const role = (session as any)?.role ?? (session as any)?.user?.role ?? ''
    return role === 'admin' || role === 'ADMIN' || role === 'superadmin'
  }, [])

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'stable' | 'inactive'>('all')

  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<typeof PAGE_SIZE_OPTIONS[number]>(10)

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadInventory = useCallback(async (silent = false) => {
    const session = getAuthSession()
    if (!session?.token) {
      setLoadError('Please sign in again to load products.')
      setIsLoading(false)
      return
    }
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    setLoadError(null)

    try {
      const response = await apiFetch('/api/products', { headers: apiHeaders(session.token) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Failed to load products')
      setInventory(Array.isArray(payload.data) ? payload.data.map(mapProduct) : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load products')
      setInventory([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => { void loadInventory() }, [loadInventory])

  // ── Derived data ────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const unique = new Set(inventory.map(item => item.category))
    return ['all', ...Array.from(unique).sort()]
  }, [inventory])

  const lowStockItems = useMemo(() =>
    inventory
      .filter(item => item.isActive && item.currentStock <= item.minStock)
      .map(item => ({
        id: item.id, code: item.code, name: item.name,
        currentStock: item.currentStock, minStock: item.minStock,
        percentageRemaining: item.minStock > 0 ? (item.currentStock / item.minStock) * 100 : 0,
      })),
    [inventory]
  )

  const totalValue = useMemo(() =>
    inventory.reduce((sum, item) => sum + (item.currentStock * item.minPrice), 0),
    [inventory]
  )

  // ── Filtering + sorting ─────────────────────────────────────────────────────

  const processedInventory = useMemo(() => {
  // Defensive check: Ensure inventory is an array
  const safeInventory = Array.isArray(inventory) ? inventory : [];

  let result = safeInventory.filter(item => {
    const q = searchQuery.toLowerCase()
    const matchSearch = !q ||
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter
    
    const status = stockStatus(item)
    const matchStatus = statusFilter === 'all' || 
                        (statusFilter === 'inactive' && !item.isActive) ||
                        (statusFilter === 'stable' && item.isActive && status === 'stable') ||
                        (statusFilter === 'low' && item.isActive && status === 'low') ||
                        (statusFilter === 'out' && item.isActive && status === 'out')
                        
    return matchSearch && matchCategory && matchStatus
  })

  result = [...result].sort((a, b) => {
    let va: string | number = a[sortField]
    let vb: string | number = b[sortField]
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return result
}, [inventory, searchQuery, categoryFilter, statusFilter, sortField, sortDir])
  // Reset page safely when search query or filter options change
  useEffect(() => { 
    setCurrentPage(1) 
  }, [searchQuery, categoryFilter, statusFilter, sortField, pageSize])

  // Pagination Math calculations
  const totalPages = Math.max(1, Math.ceil(processedInventory.length / pageSize))
  
  const paginatedInventory = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return processedInventory.slice(startIdx, startIdx + pageSize)
  }, [processedInventory, currentPage, pageSize])

  const itemRange = useMemo(() => {
    if (processedInventory.length === 0) return { start: 0, end: 0 }
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, processedInventory.length)
    return { start, end }
  }, [processedInventory.length, currentPage, pageSize])

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleAddProduct = async (productData: any) => {
    const session = getAuthSession()
    if (!session?.token) throw new Error('Please sign in again to save products.')
    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productData.name, 
          sku: productData.sku,
          category: productData.category, 
          price: Number(productData.minPrice),
          srpPrice: Number(productData.srpPrice || 0),
          quantity: Number(productData.stock),
          isActive: productData.isActive ?? true,
          imageUrl: productData.imageUrl, 
          imagePublicId: productData.imagePublicId,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Failed to save product')
      await loadInventory(true)
      setShowAddProduct(false)
      toast.success('Product added successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  const handleEditProduct = async (productData: any) => {
    if (!editingProduct) return
    const session = getAuthSession()
    if (!session?.token) throw new Error('Please sign in again to save products.')
    try {
      const response = await apiFetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: productData.name, 
          category: productData.category,
          price: Number(productData.minPrice),
          srpPrice: Number(productData.srpPrice || 0),
          isActive: productData.isActive,
          imageUrl: productData.imageUrl, 
          imagePublicId: productData.imagePublicId,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Failed to update product')
      await loadInventory(true)
      toast.success(`${productData.name} updated`)
      setEditingProduct(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  const toggleProductActiveStatus = async (item: InventoryItem) => {
    const session = getAuthSession()
    if (!session?.token) return
    try {
      const updatedState = !item.isActive
      const response = await apiFetch(`/api/products/${item.id}`, {
        method: 'PUT',
        headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updatedState }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Failed to change activation flag lifecycle state')
      }

      setInventory(prev => prev.map(p => p.id === item.id ? { ...p, isActive: updatedState } : p))
      toast.success(`Product configured to ${updatedState ? 'Active' : 'Inactive'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change activation flag lifecycle state')
    }
  }

  const handleStockUpdateSubmit = async (id: string, newStock: number) => {
    if (newStock < 0) { toast.error('Stock cannot be negative.'); return }
    const session = getAuthSession()
    if (!session?.token) return

    try {
      const response = await apiFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newStock }),
      })
      if (!response.ok) throw new Error()
      setInventory(prev => prev.map(item => item.id === id ? { ...item, currentStock: newStock } : item))
      const item = inventory.find(i => i.id === id)
      toast.success(`${item?.name || 'Product'} stock updated to ${newStock}`)
      setSelectedProduct(null)
      setStockValue('')
    } catch {
      toast.error('Failed to update product quantity')
    }
  }

  const handleDeleteProduct = async (id: string) => {
    const session = getAuthSession()
    if (!session?.token) { toast.error('Please sign in again.'); return }
    try {
      const response = await apiFetch(`/api/products/${id}`, {
        method: 'DELETE', headers: apiHeaders(session.token),
      })
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Failed to delete product')
      }
      const item = inventory.find(i => i.id === id)
      setInventory(prev => prev.filter(i => i.id !== id))
      toast.success(`${item?.name || 'Product'} deleted`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'

  function clearFilters() {
    setSearchQuery('')
    setCategoryFilter('all')
    setStatusFilter('all')
  }

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-7 animate-in fade-in duration-300">

      {/* ── Page Header ── */}
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage products, prices, stock levels and status indicators.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadInventory(true)}
            disabled={isRefreshing}
            className="h-10 w-10 rounded-xl shrink-0"
            title="Refresh inventory"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setShowAddProduct(true)}
            className="gap-2 rounded-xl bg-primary px-5 shadow-sm hover:bg-primary/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {loadError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{loadError}</span>
          <button onClick={() => loadInventory()} className="ml-auto text-xs font-semibold underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Low stock warning ── */}
      {lowStockItems.length > 0 && <StockWarning lowStockProducts={lowStockItems} />}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Products"
          value={isLoading ? '…' : inventory.length.toLocaleString()}
          icon={Package}
          color="primary"
          loading={isLoading}
        />
        <StatCard
          label="Stock Alerts"
          value={isLoading ? '…' : lowStockItems.length.toLocaleString()}
          icon={ShieldAlert}
          color="destructive"
          loading={isLoading}
        />
        <StatCard
          label="Inventory Value"
          value={isLoading ? '…' : `₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Layers}
          color="green"
          loading={isLoading}
        />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, SKU, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-xl border-input bg-background pl-10 pr-9 shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary min-w-[160px] capitalize"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          {/* Page size */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as typeof PAGE_SIZE_OPTIONS[number])}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary w-[110px]"
          >
            {PAGE_SIZE_OPTIONS.map(n => (
              <option key={n} value={n}>{n} per page</option>
            ))}
          </select>
        </div>

        {/* Bottom row: status chips + clear */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" /> Status:
            </span>
            {([
              { value: 'all', label: 'All', icon: null },
              { value: 'stable', label: 'In Stock', icon: CheckCircle2 },
              { value: 'low', label: 'Low Stock', icon: TrendingDown },
              { value: 'out', label: 'Out of Stock', icon: AlertTriangle },
              { value: 'inactive', label: 'Inactive', icon: EyeOff },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                  statusFilter === value
                    ? value === 'all'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : value === 'stable'
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : value === 'low'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : value === 'inactive'
                      ? 'bg-zinc-500 text-white border-zinc-500 shadow-sm'
                      : 'bg-red-500 text-white border-red-500 shadow-sm'
                    : 'bg-background text-muted-foreground hover:bg-muted border-input'
                }`}
              >
                {Icon && <Icon className="h-3 w-3" />}
                {label}
                {value !== 'all' && (
                  <span className={`rounded-md px-1 py-0 text-[10px] font-bold ${statusFilter === value ? 'bg-white/20' : 'bg-muted text-foreground'}`}>
                    {value === 'stable'
                      ? (Array.isArray(inventory) ? inventory.filter(i => i.isActive && stockStatus(i) === 'stable').length : 0)
                      : value === 'low'
                      ? ' ' + (Array.isArray(inventory) ? inventory.filter(i => i.isActive && stockStatus(i) === 'low').length : 0)
                      : value === 'out'
                      ? (Array.isArray(inventory) ? inventory.filter(i => i.isActive && stockStatus(i) === 'out').length : 0)
                      : (Array.isArray(inventory) ? inventory.filter(i => !i.isActive).length : 0)
                    }
                  </span>
                )}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 hover:text-rose-700 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <span className="text-[11px] text-muted-foreground">Showing</span>
            <span className="text-[11px] font-bold text-foreground bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5 text-primary">
              {processedInventory.length} of {inventory.length} products
            </span>
          </div>
        )}
      </div>

      {/* ── Table Card ── */}
      <Card className="w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3.5 text-left">
                    <SortButton field="code" label="SKU" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-left">
                    <SortButton field="name" label="Product" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-left">
                    <SortButton field="category" label="Category" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-left">
                    <SortButton field="currentStock" label="Stock" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <SortButton field="srpPrice" label="Cost/SRP" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-right">
                    <SortButton field="minPrice" label="Retail Price" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </th>
                  <th className="px-5 py-3.5 text-right text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Profit
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Margin
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Alert At
                  </th>
                  <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className={`h-4 rounded-md bg-muted animate-pulse ${j === 1 ? 'w-36' : j === 0 ? 'w-20' : 'w-16'}`} style={{ animationDelay: `${i * 60}ms` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedInventory.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-5 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                          <Package className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">No products found</p>
                          <p className="text-xs text-muted-foreground">Try adjusting your filters or search query.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map((item) => {
                    const status = stockStatus(item)
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 transition-colors group ${!item.isActive ? 'opacity-65 bg-zinc-500/5' : ''}`}
                      >
                        {/* SKU */}
                        <td className="px-5 py-3.5 text-left">
                          <span className="font-mono text-xs font-semibold text-muted-foreground bg-muted/60 border rounded-md px-2 py-1">
                            {item.code}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3.5 text-left">
                          <div className="font-semibold text-foreground text-sm">{item.name}</div>
                        </td>

                        {/* Category */}
                        <td className="px-5 py-3.5 text-left">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-muted border text-xs font-medium capitalize text-muted-foreground">
                            {item.category}
                          </span>
                        </td>

                        {/* Stock inline interaction bar */}
                        <td className="px-5 py-3.5 text-left">
                          {selectedProduct === item.id ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={stockValue}
                                onChange={(e) => setStockValue(e.target.value)}
                                className="w-16 h-8 text-xs font-semibold"
                                autoFocus
                              />
                              <Button 
                                size="sm" 
                                className="h-8 px-2 text-xs"
                                onClick={() => handleStockUpdateSubmit(item.id, parseInt(stockValue, 10) || 0)}
                              >
                                Save
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => setSelectedProduct(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-muted/80 p-1 rounded transition-colors inline-block"
                              onClick={() => {
                                setSelectedProduct(item.id)
                                setStockValue(String(item.currentStock))
                              }}
                            >
                              <StockBar current={item.currentStock} min={item.minStock} />
                            </div>
                          )}
                        </td>

                        {/* Cost/SRP */}
                        <td className="px-5 py-3.5 text-left font-mono text-xs text-muted-foreground">
                          ₱{item.minPrice.toFixed(2)} / <strong className="text-foreground">₱{item.srpPrice.toFixed(2)}</strong>
                        </td>

                        {/* Retail Price */}
                        <td className="px-5 py-3.5 text-left font-mono font-bold text-foreground text-sm">
                          ₱{item.minPrice.toFixed(2)}
                        </td>

                        {/* Profit */}
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-foreground">
                          ₱{item.profit.toFixed(2)}
                        </td>

                        {/* Margin */}
                        <td className="px-5 py-3.5 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.profitMargin >= 20 ? 'bg-emerald-100 text-emerald-700' :
                            item.profitMargin >= 10 ? 'bg-amber-100 text-amber-700' :
                            'bg-destructive/10 text-destructive'
                          }`}>
                            {item.profitMargin.toFixed(1)}%
                          </span>
                        </td>

                        {/* Alert At */}
                        <td className="px-5 py-3.5 text-right font-mono text-xs text-muted-foreground font-semibold">
                          {item.minStock} units
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5 text-center">
                          <StatusBadge status={status} isActive={item.isActive} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                              onClick={() => setEditingProduct(item)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 rounded-lg ${item.isActive ? 'text-muted-foreground hover:text-amber-600' : 'text-amber-600 hover:text-amber-700'}`}
                              onClick={() => toggleProductActiveStatus(item)}
                              title={item.isActive ? "Deactivate product" : "Activate product"}
                            >
                              {item.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                              onClick={() => {
                                if (confirm(`Delete ${item.name}?`)) handleDeleteProduct(item.id)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Dynamic Pagination Controls Footer ── */}
          {!isLoading && processedInventory.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t bg-muted/20">
              <div className="text-xs font-medium text-muted-foreground">
                Showing <span className="font-bold text-foreground">{itemRange.start}</span> to{' '}
                <span className="font-bold text-foreground">{itemRange.end}</span> of{' '}
                <span className="font-bold text-foreground">{processedInventory.length}</span> entries
              </div>
              
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg hidden sm:flex"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center justify-center text-xs font-semibold px-3 min-w-[80px]">
                  Page {currentPage} of {totalPages}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg hidden sm:flex"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overlays and Modal Systems ── */}
      {showAddProduct && (
        <ProductForm
          product={null}
          onClose={() => setShowAddProduct(false)}
          onSubmit={handleAddProduct}
          categories={categories.filter(c => c !== 'all')}
          isAdmin={isAdmin}
        />
      )}

      {editingProduct && (
        <ProductEditForm
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={handleEditProduct}
          categories={categories.filter(c => c !== 'all')}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}