'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Edit2, Trash2, Search, Package, AlertTriangle, Layers, X } from 'lucide-react'
import ProductForm from '@/components/inventory/product-form'
import ProductEditForm from '@/components/inventory/product-edit-form'
import StockWarning from '@/components/inventory/stock-warning'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

type ApiProduct = {
  id: number
  name: string
  sku: string
  category: string
  price: string
  quantity: number
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
  currentStock: number
  image: string | null
  imagePublicId: string | null
}

function mapProduct(product: ApiProduct): InventoryItem {
  const price = Number(product.price) || 0

  return {
    id: String(product.id),
    code: product.sku || '',
    name: product.name || 'Unnamed Product',
    category: product.category || 'Products',
    minStock: 5,
    minPrice: price,
    maxPrice: price,
    currentStock: product.quantity || 0,
    image: product.image_url,
    imagePublicId: product.image_public_id,
  }
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadInventory = useCallback(async () => {
    const session = getAuthSession()

    if (!session?.token) {
      setLoadError('Please sign in again to load products.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const response = await apiFetch('/api/products', {
        headers: apiHeaders(session.token),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load products')
      }

      setInventory(Array.isArray(payload.data) ? payload.data.map(mapProduct) : [])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load products')
      setInventory([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  // Extract unique categories dynamically for filter selection
  const categories = useMemo(() => {
    const unique = new Set(inventory.map(item => item.category))
    return ['all', ...Array.from(unique)]
  }, [inventory])

  // Optimized combined filtering pipeline
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
      
      const isLowStock = item.currentStock <= item.minStock && item.currentStock > 0
      const isOutOfStock = item.currentStock === 0
      
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'low' && isLowStock) ||
        (statusFilter === 'out' && isOutOfStock)

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [inventory, searchQuery, categoryFilter, statusFilter])

  const handleAddProduct = async (productData: any) => {
    const session = getAuthSession()
    if (!session?.token) throw new Error('Please sign in again to save products.')

    try {
      const response = await apiFetch('/api/products', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(apiHeaders(session.token).entries()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: productData.name,
          sku: productData.code,
          category: productData.category,
          price: Number(productData.minPrice),
          quantity: Number(productData.stock),
          imageUrl: productData.imageUrl,
          imagePublicId: productData.imagePublicId,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Failed to save product')

      const saved = mapProduct(payload.data)
      setInventory(prev => [saved, ...prev.filter(item => item.code !== saved.code)])
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
        headers: {
          ...Object.fromEntries(apiHeaders(session.token).entries()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: productData.name,
          category: productData.category,
          price: Number(productData.minPrice),
          imageUrl: productData.imageUrl,
          imagePublicId: productData.imagePublicId,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || payload?.error || 'Failed to update product')

      const saved = mapProduct(payload.data)
      setInventory(prev => prev.map(item => (
        item.id === editingProduct.id
          ? { ...saved, minStock: item.minStock, maxPrice: Number(productData.maxPrice) }
          : item
      )))
      toast.success(`${productData.name} updated successfully`)
      setEditingProduct(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    }
  }

  const handleStockUpdate = (id: string, newStock: number) => {
    if (newStock < 0) {
      toast.error('Stock value cannot be negative.')
      return
    }
    setInventory(prev => prev.map(item =>
      item.id === id ? { ...item, currentStock: newStock } : item
    ))
    const item = inventory.find(i => i.id === id)
    toast.success(`${item?.name || 'Product'} stock updated to ${newStock}`)
    setSelectedProduct(null)
    setStockValue('')
  }

  const handleDeleteProduct = async (id: string) => {
    const session = getAuthSession()
    if (!session?.token) {
      toast.error('Please sign in again to delete products.')
      return
    }
    
    try {
      const response = await apiFetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: apiHeaders(session.token),
      })
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Failed to delete product')
      }
      const item = inventory.find(i => i.id === id)
      setInventory(prev => prev.filter(i => i.id !== id))
      toast.success(`${item?.name || 'Product'} deleted successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }

  // Precomputed tracking stats logic
  const lowStockItems = useMemo(() => {
    return inventory
      .filter(item => item.currentStock <= item.minStock)
      .map(item => ({
        id: item.id,
        code: item.code,
        name: item.name,
        currentStock: item.currentStock,
        minStock: item.minStock,
        percentageRemaining: item.minStock > 0 ? (item.currentStock / item.minStock) * 100 : 0,
      }))
  }, [inventory])

  const totalValue = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (item.currentStock * item.minPrice), 0)
  }, [inventory])

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header View Block */}
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, tracking metrics, prices, and stock indicators.</p>
        </div>
        <Button onClick={() => setShowAddProduct(true)} className="w-full sm:w-auto gap-2 rounded-xl bg-primary px-5 shadow-sm hover:bg-primary/90 transition-all">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span>{loadError}</span>
        </div>
      )}

      {lowStockItems.length > 0 && <StockWarning lowStockProducts={lowStockItems} />}

      {/* Analytics Info Row */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 rounded-2xl shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Unique Items</p>
              <p className="text-3xl font-bold tracking-tight text-foreground">{isLoading ? '...' : inventory.length}</p>
            </div>
            <div className="p-3 bg-primary/10 rounded-xl text-primary"><Package className="h-6 w-6" /></div>
          </CardContent>
        </Card>

        <Card className="border-border/60 rounded-2xl shadow-sm bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Alert Flag Items</p>
              <p className="text-3xl font-bold tracking-tight text-destructive">{isLoading ? '...' : lowStockItems.length}</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-xl text-destructive"><AlertTriangle className="h-6 w-6" /></div>
          </CardContent>
        </Card>

        <Card className="border-border/60 rounded-2xl shadow-sm bg-card/50 backdrop-blur-sm sm:col-span-2 xl:col-span-1">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Total Asset Value</p>
              <p className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400">{isLoading ? '...' : `₱${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p>
            </div>
            <div className="p-3 bg-green-500/10 rounded-xl text-green-600"><Layers className="h-6 w-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Search Actions Matrix */}
      <div className="flex flex-col md:flex-row gap-3 w-full">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by product name or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl border-input bg-background pl-10 shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-primary capitalize"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
            ))}
          </select>

          <div className="flex rounded-xl border bg-background p-1 shadow-sm shrink-0">
            {(['all', 'low', 'out'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all capitalize ${
                  statusFilter === status 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {status === 'all' ? 'All Stock' : status === 'low' ? 'Low Stock' : 'Out'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Core Inventory Listing Table */}
      <Card className="w-full overflow-hidden rounded-2xl border bg-card shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3.5 text-left font-semibold text-muted-foreground tracking-wider uppercase text-xs">Code/SKU</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-muted-foreground tracking-wider uppercase text-xs">Product Details</th>
                  <th className="px-6 py-3.5 text-left font-semibold text-muted-foreground tracking-wider uppercase text-xs">Category</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-muted-foreground tracking-wider uppercase text-xs">Stock Level</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-muted-foreground tracking-wider uppercase text-xs">Unit Valuation</th>
                  <th className="px-6 py-3.5 text-right font-semibold text-muted-foreground tracking-wider uppercase text-xs">Alert Line</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wider uppercase text-xs">Status</th>
                  <th className="px-6 py-3.5 text-center font-semibold text-muted-foreground tracking-wider uppercase text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Querying inventory catalog...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Package className="h-10 w-10 text-muted-foreground/40" />
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">No records matched filter matrix</p>
                          <p className="text-xs">Try modifying the search filter strings or adding a new inventory product tier.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item) => {
                    const isLowStock = item.currentStock <= item.minStock && item.currentStock > 0
                    const isOutOfStock = item.currentStock === 0
                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground font-semibold">{item.code}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-muted text-xs capitalize border font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => {
                              setSelectedProduct(item.id)
                              setStockValue(String(item.currentStock))
                            }}
                            className={`inline-block px-3 py-1 rounded-full font-bold text-xs transition-transform hover:scale-105 ${
                              isOutOfStock
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                : isLowStock
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                            }`}
                            title="Click to quickly modify stock values"
                          >
                            {item.currentStock} Units
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">
                          ₱{item.minPrice.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right text-muted-foreground font-medium">{item.minStock}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold tracking-wide ${
                            isOutOfStock
                              ? 'bg-red-600 text-white'
                              : isLowStock
                              ? 'bg-amber-500 text-white'
                              : 'bg-green-600 text-white'
                          }`}>
                            {isOutOfStock ? 'OUT' : isLowStock ? 'LOW' : 'STABLE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingProduct(item)}
                              className="h-8 w-8 rounded-lg border hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit product data structure"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm(`Are you absolutely sure you want to remove "${item.name}"?`)) {
                                  void handleDeleteProduct(item.id)
                                }
                              }}
                              className="h-8 w-8 rounded-lg border hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Remove item record"
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
        </CardContent>
      </Card>

      {/* Add Dialog Framework Component */}
      {showAddProduct && (
        <ProductForm
          onClose={() => setShowAddProduct(false)}
          onSubmit={handleAddProduct}
        />
      )}

      {/* Edit View Overlay Modal Context */}
      {editingProduct && (
        <ProductEditForm
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={handleEditProduct}
        />
      )}

      {/* Embedded Stock Adjustment Toolset Popover */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm border shadow-xl animate-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold">Quick Stock Update</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSelectedProduct(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="quick-stock-input">Absolute Balance in Store Room</Label>
                <Input
                  id="quick-stock-input"
                  type="number"
                  min="0"
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  placeholder="0"
                  className="rounded-xl"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleStockUpdate(selectedProduct, parseInt(stockValue, 10) || 0)
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSelectedProduct(null)} className="flex-1 rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={() => handleStockUpdate(selectedProduct, parseInt(stockValue, 10) || 0)}
                  className="flex-1 rounded-xl bg-primary"
                >
                  Commit Balance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}