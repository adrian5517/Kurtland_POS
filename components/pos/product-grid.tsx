'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Plus } from 'lucide-react'

export interface POSProduct {
  id: string
  code: string
  name: string
  price: number
  category: string
  stock: number
  minPrice: number
  maxPrice: number
  currentStock: number
  image: string | null
  isActive: boolean
}

interface POSProductGridProps {
  products: POSProduct[]
  onProductClick: (product: POSProduct) => void
}

// Stock state drives badge color + label
function getStockState(stock: number) {
  if (stock === 0) return { label: 'Out', className: 'bg-red-500/90 text-white' }
  if (stock <= 5) return { label: `${stock} left`, className: 'bg-amber-500/90 text-white' }
  return { label: String(stock), className: 'bg-black/40 text-white' }
}

export default function POSProductGrid({ products, onProductClick }: POSProductGridProps) {
  const groupedProducts = products.reduce<Record<string, POSProduct[]>>((acc, p) => {
    ;(acc[p.category] ??= []).push(p)
    return acc
  }, {})

  const categories = Object.keys(groupedProducts)

  return (
    <div className="space-y-6 pb-2">
      {categories.map((category) => (
        <div key={category} className="space-y-3 animate-in fade-in duration-300">
          {/* Category heading */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-primary capitalize">{category}</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {groupedProducts[category].length} items
            </span>
          </div>

          {/*
            auto-fill grid: each card is at least 160px wide and grows to fill space.
            This produces the right column count at every viewport without hardcoded breakpoints:
              ~320px container → 2 cols   ~480px → 3 cols
              ~640px container → 4 cols   ~800px → 5 cols  etc.
          */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,160px),1fr))] gap-3 sm:gap-4">
            {groupedProducts[category].map((product) => {
              const stock = product.currentStock ?? product.stock
              const isOutOfStock = stock === 0
              const stockState = getStockState(stock)

              return (
                <Card
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  {/* Image — aspect-ratio scales naturally with card width */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/30">
                        <Package className="h-8 w-8" />
                      </div>
                    )}

                    {/* Stock badge — overlaid top-right, no extra row needed */}
                    <span
                      className={`absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm ${stockState.className}`}
                    >
                      {stockState.label}
                    </span>

                    {/* Out-of-stock overlay */}
                    {isOutOfStock && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                        <span className="rounded-lg bg-background/80 px-2 py-1 text-xs font-bold text-muted-foreground">
                          Out of stock
                        </span>
                      </div>
                    )}
                  </div>

                  <CardContent className="flex flex-1 flex-col gap-2 p-3">
                    {/* Name + code */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-mono text-muted-foreground">
                        {product.code}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {product.name}
                      </h3>
                    </div>

                    {/* Price + Add button */}
                    <div className="space-y-2 border-t border-primary/10 pt-2">
                      {/* Use product.price — the retail/selling price mapped from srp_price */}
                      <span className="block text-sm font-black text-primary">
                        ₱{product.price.toFixed(2)}
                      </span>

                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          onProductClick(product)
                        }}
                        disabled={isOutOfStock}
                        className="h-9 w-full rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Package className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-sm font-semibold">No products found</p>
          <p className="text-xs opacity-60">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  )
}

