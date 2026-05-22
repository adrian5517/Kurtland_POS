'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Edit2, Trash2, Search } from 'lucide-react'
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
  const price = Number(product.price)

  return {
    id: String(product.id),
    code: product.sku,
    name: product.name,
    category: product.category || 'Products',
    minStock: 5,
    minPrice: price,
    maxPrice: price,
    currentStock: product.quantity,
    image: product.image_url,
    imagePublicId: product.image_public_id,
  }
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
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

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddProduct = async (productData: any) => {
    const session = getAuthSession()

    if (!session?.token) {
      throw new Error('Please sign in again to save products.')
    }

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
        price: productData.minPrice,
        quantity: productData.stock,
        imageUrl: productData.imageUrl,
        imagePublicId: productData.imagePublicId,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to save product')
    }

    const saved = mapProduct(payload.data)

    setInventory((prev) => [
      saved,
      ...prev.filter((item) => item.code !== saved.code),
    ])
    setShowAddProduct(false)
    toast.success('Product added successfully')
  }

  const handleEditProduct = async (productData: any) => {
    if (!editingProduct) {
      return
    }

    const session = getAuthSession()

    if (!session?.token) {
      throw new Error('Please sign in again to save products.')
    }

    const response = await apiFetch(`/api/products/${editingProduct.id}`, {
      method: 'PUT',
      headers: {
        ...Object.fromEntries(apiHeaders(session.token).entries()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: productData.name,
        category: productData.category,
        price: productData.minPrice,
        imageUrl: productData.imageUrl,
        imagePublicId: productData.imagePublicId,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || 'Failed to update product')
    }

    const saved = mapProduct(payload.data)

    setInventory((prev) => prev.map((item) => (
      item.id === editingProduct.id
        ? {
            ...saved,
            minStock: item.minStock,
            maxPrice: productData.maxPrice,
          }
        : item
    )))
    toast.success(`${productData.name} updated successfully`)
    setEditingProduct(null)
  }

  const handleStockUpdate = (id: string, newStock: number) => {
    setInventory(prev => prev.map(item =>
      item.id === id ? { ...item, currentStock: newStock } : item
    ))
    const item = inventory.find(i => i.id === id)
    toast.success(`${item?.name} stock updated to ${newStock}`)
    setSelectedProduct(null)
    setStockValue('')
  }

  const handleDeleteProduct = async (id: string) => {
    const session = getAuthSession()

    if (!session?.token){
      toast.error('Please sign in again to delete products.')
      return
    }
    try {
      const response = await apiFetch(`/api/products/${id}`,{
        method: 'DELETE',
        headers: apiHeaders(session.token),
      })
      if (!response.ok && response.status !== 204){
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Failed to delete product')
      }
      const item = inventory.find(i => i.id === id)
      setInventory(prev => prev.filter(item => item.id !== id))
      toast.success(`${item?.name} deleted successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete product')
    }
  }

  const lowStockItems = inventory
    .filter(item => item.currentStock <= item.minStock)
    .map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      currentStock: item.currentStock,
      minStock: item.minStock,
      percentageRemaining: (item.currentStock / item.minStock) * 100,
    }))

  const totalValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.minPrice), 0)

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Inventory Management</h1>
          <p className="text-sm text-muted-foreground">Manage products, prices, stock thresholds, and low-stock alerts.</p>
        </div>
        <Button onClick={() => setShowAddProduct(true)} className="w-full sm:w-auto gap-2 rounded-2xl bg-primary px-5 hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {/* Stock Warnings */}
      {lowStockItems.length > 0 && (
        <StockWarning lowStockProducts={lowStockItems} />
      )}

      {/* Stats */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{isLoading ? '...' : inventory.length}</p>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-secondary">{isLoading ? '...' : lowStockItems.length}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95 sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{isLoading ? '...' : `₱${totalValue.toFixed(2)}`}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by product name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-2xl border-primary/20 bg-card/95 pl-10 shadow-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Inventory Table */}
      <Card className="w-full overflow-hidden rounded-3xl border-primary/20 bg-card/95 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-primary/20 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Code</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Category</th>
                  <th className="px-6 py-3 text-right font-semibold text-foreground">Stock</th>
                  <th className="px-6 py-3 text-right font-semibold text-foreground">Price Range</th>
                  <th className="px-6 py-3 text-right font-semibold text-foreground">Min Alert</th>
                  <th className="px-6 py-3 text-center font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item, idx) => {
                  const isLowStock = item.currentStock <= item.minStock
                  const isOutOfStock = item.currentStock === 0
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-primary/10 hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{item.code}</td>
                      <td className="px-6 py-4 font-medium text-foreground">{item.name}</td>
                      <td className="px-6 py-4 text-muted-foreground capitalize">{item.category}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full font-semibold ${
                          isOutOfStock
                            ? 'bg-red-500/20 text-red-600'
                            : isLowStock
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {item.currentStock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold">
                        <span className="text-primary">₱{item.minPrice}</span>
                        <span className="text-muted-foreground"> - </span>
                        <span className="text-primary">₱{item.maxPrice}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-muted-foreground">{item.minStock}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          isOutOfStock
                            ? 'bg-red-500 text-white'
                            : isLowStock
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-green-500 text-white'
                        }`}>
                          {isOutOfStock ? 'Out' : isLowStock ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingProduct(item)}
                            className="h-9 w-9 rounded-xl p-0 border-primary/20 hover:bg-primary/10"
                            title="Edit product details"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeleteProduct(item.id)}
                            className="h-9 w-9 rounded-xl p-0 border-secondary/20 text-secondary hover:bg-secondary/10"
                            title="Delete product"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      {showAddProduct && (
        <ProductForm
          onClose={() => setShowAddProduct(false)}
          onSubmit={handleAddProduct}
        />
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <ProductEditForm
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSubmit={handleEditProduct}
        />
      )}

      {/* Edit Stock Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary">Update Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">New Stock Quantity</Label>
                <Input
                  type="number"
                  value={stockValue}
                  onChange={(e) => setStockValue(e.target.value)}
                  placeholder="0"
                  className="border-primary/20"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 border-primary/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const newStock = parseInt(stockValue) || 0
                    handleStockUpdate(selectedProduct, newStock)
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Update
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
