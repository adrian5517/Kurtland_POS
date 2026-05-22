'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Search } from 'lucide-react'
import POSProductGrid from './product-grid'

interface Product {
  id: string
  code: string
  name: string
  price: number
  category: string
  stock: number
  minPrice?: number
  maxPrice?: number
  currentStock?: number
  image?: string | null
}

interface ProductSelectorProps {
  products: Product[]
  onProductClick: (product: Product) => void
  onClose: () => void
}

export default function ProductSelector({
  products,
  onProductClick,
  onClose,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.code.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end lg:hidden z-50">
      <Card className="w-full max-h-[90vh] rounded-t-2xl border-primary/20">
        <CardHeader className="flex flex-row justify-between items-center pb-3 sticky top-0 bg-card border-b">
          <CardTitle className="text-lg font-bold text-primary">Select Products</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-3 space-y-3 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Search Bar */}
          <div className="relative sticky top-0 bg-card z-10">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-primary/20 h-9 text-sm"
            />
          </div>

          {/* Products Grid */}
          <POSProductGrid
            products={filteredProducts}
            onProductClick={(product) => {
              onProductClick(product)
              onClose()
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
