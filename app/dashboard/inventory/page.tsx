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
  CheckCircle2, SlidersHorizontal, EyeOff, Eye, TrendingUp, BarChart3
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
  min_stock?: number
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
    minStock: product.min_stock || 5,
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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const session = getAuthSession()
    console.log('🔐 Auth session:', session)
    const role = (session as any)?.role ?? (session as any)?.user?.role ?? ''
    console.log('👤 User role:', role)
    const adminStatus = role === 'admin' || role === 'ADMIN' || role === 'superadmin'
    console.log('👑 Is admin:', adminStatus)
    setIsAdmin(adminStatus)
  }, [])

  // Log when isAdmin changes
  useEffect(() => {
    console.log('✅ isAdmin state updated:', isAdmin)
  }, [isAdmin])

  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out' | 'stable' | 'inactive'>('all')

  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [restockingProduct, setRestockingProduct] = useState<string | null>(null)
  const [restockQuantity, setRestockQuantity] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Bulk profit margin control states
  const [showBulkProfitModal, setShowBulkProfitModal] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [bulkProfitMargin, setBulkProfitMargin] = useState('')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  
  // Product selector for distribution
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [distributionSearch, setDistributionSearch] = useState('')
  const [selectedDistributionProducts, setSelectedDistributionProducts] = useState<Set<string>>(new Set())

  // Product distribution states
  const [showDistributionModal, setShowDistributionModal] = useState(false)
  const [distributionProduct, setDistributionProduct] = useState<InventoryItem | null>(null)
  const [distributionProducts, setDistributionProducts] = useState<InventoryItem[]>([])
  const [cashiers, setCashiers] = useState<Array<{ id: number; email: string }>>([])
  const [selectedCashiers, setSelectedCashiers] = useState<Set<number>>(new Set())
  const [isLoadingCashiers, setIsLoadingCashiers] = useState(false)
  const [isDistributing, setIsDistributing] = useState(false)

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

  const totalProfit = useMemo(() => {
    const activeItems = inventory.filter(item => item.isActive)
    return activeItems.reduce((sum, item) => sum + (item.profit * item.currentStock), 0)
  }, [inventory])

  const avgProfitMargin = useMemo(() => {
    const activeItems = inventory.filter(item => item.isActive && item.currentStock > 0)
    if (activeItems.length === 0) return 0
    const totalMargin = activeItems.reduce((sum, item) => sum + item.profitMargin, 0)
    return totalMargin / activeItems.length
  }, [inventory])

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
          srpPrice: Number(productData.maxPrice || productData.minPrice),
          quantity: Number(productData.stock),
          min_stock: Number(productData.minStock || 5),
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
          srpPrice: Number(productData.maxPrice || productData.minPrice),
          min_stock: Number(productData.minStock || 5),
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

  const handleRestockSubmit = async (id: string, quantityToAdd: number) => {
    if (quantityToAdd <= 0) { toast.error('Restock quantity must be positive.'); return }
    const session = getAuthSession()
    if (!session?.token) return

    try {
      const item = inventory.find(i => i.id === id)
      if (!item) { toast.error('Product not found'); return }
      
      const newStock = item.currentStock + quantityToAdd
      const response = await apiFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newStock }),
      })
      if (!response.ok) throw new Error()
      setInventory(prev => prev.map(p => p.id === id ? { ...p, currentStock: newStock } : p))
      toast.success(`✓ ${item.name} restocked (+${quantityToAdd} units → ${newStock} total)`)
      setRestockingProduct(null)
      setRestockQuantity('')
    } catch {
      toast.error('Failed to restock product')
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

  const handleBulkProfitUpdate = async () => {
    if (selectedProductIds.size === 0) {
      toast.error('Please select at least one product')
      return
    }
    
    const profitMargin = parseFloat(bulkProfitMargin)
    if (isNaN(profitMargin) || profitMargin < 0 || profitMargin > 100) {
      toast.error('Please enter a valid profit margin (0-100%)')
      return
    }

    const session = getAuthSession()
    if (!session?.token) {
      toast.error('Please sign in again')
      return
    }

    setIsBulkUpdating(true)
    try {
      let successCount = 0
      for (const productId of selectedProductIds) {
        const product = inventory.find(p => p.id === productId)
        if (!product) continue

        // Calculate new SRP based on profit margin
        // profitMargin = (srpPrice - costPrice) / costPrice * 100
        // srpPrice = costPrice * (1 + profitMargin/100)
        const newSrpPrice = product.minPrice * (1 + profitMargin / 100)

        const response = await apiFetch(`/api/products/${productId}`, {
          method: 'PUT',
          headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            srpPrice: Number(newSrpPrice.toFixed(2)),
          }),
        })

        if (response.ok) {
          successCount++
        }
      }

      if (successCount > 0) {
        await loadInventory(true)
        setShowBulkProfitModal(false)
        setSelectedProductIds(new Set())
        setBulkProfitMargin('')
        toast.success(`✓ Updated profit margin for ${successCount} product(s)`)
      } else {
        toast.error('Failed to update products')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profit margin')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  // Log when product selector modal opens/closes
  useEffect(() => {
    console.log('🎪 Product selector modal:', showProductSelector ? 'OPENED' : 'closed')
  }, [showProductSelector])

  // Log when distribution modal opens/closes
  useEffect(() => {
    if (showDistributionModal) {
      console.log('🎬 Distribution modal OPENED', {
        hasProduct: !!distributionProduct?.name,
        hasProducts: distributionProducts.length,
        productNames: distributionProducts.map(p => p.name)
      })
    }
  }, [showDistributionModal])

  const fetchCashiers = useCallback(async () => {
    console.log('🔄 Fetching cashiers for distribution...')
    setIsLoadingCashiers(true)
    setSelectedCashiers(new Set())

    const session = getAuthSession()
    console.log('🔐 Session for API call:', { 
      hasToken: !!session?.token, 
      tokenLength: session?.token?.length,
      hasUser: !!session?.user,
      userRole: (session as any)?.user?.role
    })
    
    if (!session?.token) {
      console.error('❌ No session token')
      toast.error('Please sign in again')
      setIsLoadingCashiers(false)
      return
    }

    try {
      console.log('📡 Fetching cashiers from /api/products/cashiers/list')
      const headers = apiHeaders(session.token)
      console.log('📡 Request headers:', {
        'content-type': headers['Content-Type'],
        'authorization': `Bearer ${headers['Authorization']?.substring(0, 20)}...`,
      })
      
      // Load all cashiers
      const cashierResponse = await apiFetch('/api/products/cashiers/list', {
        method: 'GET',
        headers,
      })
      
      console.log('📡 Cashier response status:', cashierResponse.status)
      const cashierData = await cashierResponse.json()
      console.log('✓ Cashiers response:', { 
        ok: cashierResponse.ok, 
        status: cashierResponse.status,
        data: cashierData,
        dataArray: Array.isArray(cashierData?.data),
        dataLength: cashierData?.data?.length
      })
      
      if (cashierResponse.ok) {
        console.log('✓ Setting cashiers:', cashierData.data)
        setCashiers(cashierData.data || [])
      } else {
        console.error('❌ Failed to fetch cashiers:', { status: cashierResponse.status, data: cashierData })
        toast.error(`Failed to load cashiers: ${cashierResponse.status}`)
      }
    } catch (error) {
      console.error('❌ Error fetching cashiers:', error)
      toast.error('Failed to load cashiers')
      setCashiers([])
    } finally {
      setIsLoadingCashiers(false)
    }
  }, [toast])

  // Fetch cashiers when distribution modal opens
  useEffect(() => {
    if (showDistributionModal) {
      fetchCashiers()
    }
  }, [showDistributionModal, fetchCashiers])

  const openDistributionModal = async (product: InventoryItem) => {
    console.log('🔄 Opening distribution modal for:', product.name)
    setDistributionProduct(product)
    setDistributionProducts([product])
    setShowDistributionModal(true)
    // cashiers will be fetched by useEffect
  }

  const handleDistributeProduct = async () => {
    const productsToDistribute = distributionProducts.length > 0 ? distributionProducts : (distributionProduct ? [distributionProduct] : [])
    
    if (productsToDistribute.length === 0) {
      console.error('❌ No products selected')
      return
    }

    if (selectedCashiers.size === 0) {
      toast.error('Please select at least one cashier')
      return
    }

    const session = getAuthSession()
    if (!session?.token) {
      console.error('❌ No session token')
      toast.error('Please sign in again')
      return
    }

    setIsDistributing(true)
    try {
      const cashierIds = Array.from(selectedCashiers)
      console.log('📦 Distributing products:', productsToDistribute.map(p => p.name).join(', '), 'to cashiers:', cashierIds)
      
      // Distribute each product to the selected cashiers
      for (const product of productsToDistribute) {
        const payload = { cashierIds }
        console.log('📡 POST /api/products/' + product.id + '/assign-cashiers', payload)
        
        const response = await apiFetch(`/api/products/${product.id}/assign-cashiers`, {
          method: 'POST',
          headers: { ...Object.fromEntries(apiHeaders(session.token).entries()), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const responseData = await response.json()
        console.log('✓ Distribution response:', { ok: response.ok, data: responseData })
        
        if (!response.ok) {
          throw new Error(responseData?.message || `Failed to distribute ${product.name}`)
        }
      }

      setShowDistributionModal(false)
      setDistributionProduct(null)
      setDistributionProducts([])
      setSelectedCashiers(new Set())
      const productsCount = productsToDistribute.length
      const productNames = productsCount === 1 ? productsToDistribute[0].name : `${productsCount} products`
      toast.success(`✓ ${productNames} assigned to ${selectedCashiers.size} cashier(s)`)
    } catch (error) {
      console.error('❌ Error in handleDistributeProduct:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to distribute product')
    } finally {
      setIsDistributing(false)
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
          {isAdmin && (
            <Button
              onClick={() => {
                console.log('🎯 Distribute button clicked (from toolbar)')
                setShowProductSelector(true)
                setDistributionSearch('')
              }}
              variant="outline"
              className="gap-2 rounded-xl px-5 shadow-sm transition-all"
              title="Distribute products to cashiers"
            >
              <Package className="h-4 w-4" />
              Distribute
            </Button>
          )}
          <Button
            onClick={() => setShowBulkProfitModal(true)}
            variant="outline"
            className="gap-2 rounded-xl px-5 shadow-sm transition-all"
            title="Update profit margin for multiple products"
          >
            <TrendingUp className="h-4 w-4" />
            Bulk Profit
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
      {lowStockItems.length > 0 && (
        <StockWarning 
          lowStockProducts={lowStockItems}
          onRestock={(id, name) => {
            setRestockingProduct(id)
            setRestockQuantity('')
            setTimeout(() => {
              document.querySelector(`[data-product-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
          }}
        />
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Products"
          value={isLoading ? '…' : inventory.filter(i => i.isActive).length.toLocaleString()}
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
          label="Inventory Cost"
          value={isLoading ? '…' : `₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Layers}
          color="primary"
          loading={isLoading}
        />
        <StatCard
          label="Profit Potential"
          value={isLoading ? '…' : `₱${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
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
                        data-product-id={item.id}
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
                          {restockingProduct === item.id ? (
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="number"
                                value={restockQuantity}
                                onChange={(e) => setRestockQuantity(e.target.value)}
                                placeholder="Qty"
                                className="w-14 h-8 text-xs font-semibold text-center"
                                autoFocus
                                min="1"
                              />
                              <Button 
                                size="sm" 
                                className="h-8 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleRestockSubmit(item.id, parseInt(restockQuantity, 10) || 0)}
                              >
                                Add
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => setRestockingProduct(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-emerald-600 rounded-lg transition-colors"
                                onClick={() => {
                                  setRestockingProduct(item.id)
                                  setRestockQuantity('')
                                }}
                                title="Restock product"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                                onClick={() => setEditingProduct(item)}
                                title="Edit product"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-amber-600 rounded-lg"
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
                                title="Delete product"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
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

      {/* ── Bulk Profit Margin Modal ── */}
      {showBulkProfitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg rounded-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Bulk Profit Margin Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Product Selection Table */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select Products</Label>
                <div className="border rounded-lg max-h-64 overflow-y-auto">
                  <div className="space-y-1 p-2">
                    {inventory.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No products available</p>
                    ) : (
                      inventory.map(product => (
                        <div
                          key={product.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            const newSet = new Set(selectedProductIds)
                            if (newSet.has(product.id)) {
                              newSet.delete(product.id)
                            } else {
                              newSet.add(product.id)
                            }
                            setSelectedProductIds(newSet)
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedProductIds.has(product.id)}
                            onChange={() => {}}
                            className="h-4 w-4 rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{product.name}</p>
                            <p className="text-xs text-muted-foreground truncate">SKU: {product.code} • Cost: ₱{product.minPrice.toFixed(2)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-muted-foreground">Margin: {product.profitMargin.toFixed(1)}%</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{selectedProductIds.size} product(s) selected</p>
              </div>

              {/* Profit Margin Input */}
              <div className="space-y-2">
                <Label htmlFor="profit-margin" className="text-sm font-semibold">
                  New Profit Margin (%)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="profit-margin"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={bulkProfitMargin}
                    onChange={(e) => setBulkProfitMargin(e.target.value)}
                    placeholder="e.g., 30"
                    className="rounded-lg"
                  />
                  <span className="text-sm font-semibold text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Example: If cost is ₱10 and margin is 30%, SRP will be ₱13
                </p>
              </div>

              {/* Preview */}
              {selectedProductIds.size > 0 && bulkProfitMargin && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-muted">
                  <p className="text-xs font-semibold text-foreground">Preview:</p>
                  <div className="space-y-1">
                    {Array.from(selectedProductIds)
                      .map(id => inventory.find(p => p.id === id))
                      .filter(Boolean)
                      .slice(0, 3)
                      .map(product => {
                        const margin = parseFloat(bulkProfitMargin)
                        const newSrp = product!.minPrice * (1 + margin / 100)
                        return (
                          <div key={product!.id} className="text-xs text-muted-foreground">
                            <span className="font-medium">{product!.name}:</span> ₱{product!.minPrice.toFixed(2)} → ₱{newSrp.toFixed(2)}
                          </div>
                        )
                      })}
                    {selectedProductIds.size > 3 && (
                      <p className="text-xs text-muted-foreground italic">+{selectedProductIds.size - 3} more products...</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleBulkProfitUpdate}
                  disabled={isBulkUpdating || selectedProductIds.size === 0 || !bulkProfitMargin}
                  className="flex-1 bg-primary hover:bg-primary/90 rounded-lg"
                >
                  {isBulkUpdating ? 'Updating...' : 'Apply to Selected Products'}
                </Button>
                <Button
                  onClick={() => {
                    setShowBulkProfitModal(false)
                    setSelectedProductIds(new Set())
                    setBulkProfitMargin('')
                  }}
                  variant="outline"
                  disabled={isBulkUpdating}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Product Distribution Modal ── */}
      {showDistributionModal && (distributionProduct || distributionProducts.length > 0) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl shadow-lg rounded-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Distribute: {distributionProducts.length > 0 ? `${distributionProducts.length} product(s)` : distributionProduct?.name}
              </CardTitle>
              {distributionProducts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {distributionProducts.map(p => (
                    <div key={p.id} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-2">Select which cashiers can access {distributionProducts.length > 0 ? 'these products' : 'this product'}</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {isLoadingCashiers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-5 w-5 text-primary" />
                </div>
              ) : cashiers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No cashiers available</p>
              ) : (
                <div className="border rounded-lg max-h-72 overflow-y-auto">
                  <div className="space-y-1 p-2">
                    {cashiers.map(cashier => (
                      <div
                        key={cashier.id}
                        className="flex items-center gap-3 p-3 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => {
                          const newSet = new Set(selectedCashiers)
                          if (newSet.has(cashier.id)) {
                            newSet.delete(cashier.id)
                          } else {
                            newSet.add(cashier.id)
                          }
                          setSelectedCashiers(newSet)
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCashiers.has(cashier.id)}
                          onChange={() => {}}
                          className="h-4 w-4 rounded cursor-pointer"
                        />
                        <span className="text-sm font-medium flex-1">{cashier.email}</span>
                        {selectedCashiers.has(cashier.id) && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-3 border border-muted">
                <p className="text-xs font-semibold text-foreground">
                  {selectedCashiers.size} of {cashiers.length} cashier(s) selected
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleDistributeProduct}
                  disabled={isDistributing}
                  className="flex-1 bg-primary hover:bg-primary/90 rounded-lg"
                >
                  {isDistributing ? 'Distributing...' : 'Confirm Distribution'}
                </Button>
                <Button
                  onClick={() => {
                    setShowDistributionModal(false)
                    setDistributionProduct(null)
                    setSelectedCashiers(new Set())
                  }}
                  variant="outline"
                  disabled={isDistributing}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Product Selector Modal (for Distribute from toolbar) ── */}
      {showProductSelector && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg rounded-2xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Select Products to Distribute
              </CardTitle>
              {selectedDistributionProducts.size > 0 && (
                <p className="text-sm text-primary mt-2 font-medium">{selectedDistributionProducts.size} product(s) selected</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <Input
                placeholder="Search products..."
                value={distributionSearch}
                onChange={(e) => setDistributionSearch(e.target.value)}
                className="rounded-lg"
              />
              <div className="max-h-64 overflow-y-auto space-y-2">
                {inventory
                  .filter(p => 
                    p.name.toLowerCase().includes(distributionSearch.toLowerCase()) ||
                    p.code.toLowerCase().includes(distributionSearch.toLowerCase())
                  )
                  .map(product => {
                    const isSelected = selectedDistributionProducts.has(product.id)
                    return (
                      <button
                        key={product.id}
                        onClick={() => {
                          const newSet = new Set(selectedDistributionProducts)
                          if (newSet.has(product.id)) {
                            newSet.delete(product.id)
                          } else {
                            newSet.add(product.id)
                          }
                          setSelectedDistributionProducts(newSet)
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-transparent hover:border-primary/30 hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground'
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.code}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-primary">₱{product.minPrice.toFixed(2)}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    console.log('🔷 Distribute Selected button clicked, selectedDistributionProducts:', Array.from(selectedDistributionProducts))
                    if (selectedDistributionProducts.size === 0) {
                      toast.error('Please select at least one product')
                      return
                    }
                    const selectedProducts = inventory.filter(p => selectedDistributionProducts.has(p.id))
                    console.log('📋 Selected products to distribute:', selectedProducts.map(p => p.name))
                    setDistributionProducts(selectedProducts)
                    setDistributionProduct(null)
                    setShowDistributionModal(true)
                    setShowProductSelector(false)
                    setDistributionSearch('')
                    setSelectedCashiers(new Set())
                  }}
                  className="flex-1 rounded-lg"
                  disabled={selectedDistributionProducts.size === 0}
                >
                  Distribute Selected
                </Button>
                <Button
                  onClick={() => {
                    setShowProductSelector(false)
                    setDistributionSearch('')
                    setSelectedDistributionProducts(new Set())
                  }}
                  variant="outline"
                  className="flex-1 rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}