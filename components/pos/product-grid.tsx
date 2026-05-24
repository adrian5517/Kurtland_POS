'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus } from 'lucide-react'

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

interface POSProductGridProps {
  products: Product[]
  onProductClick: (product: Product) => void
}

export default function POSProductGrid({
  products,
  onProductClick,
}: POSProductGridProps) {
  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = []
    }
    acc[product.category].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  const categories = Object.keys(groupedProducts)

  return (
    <div className="space-y-6 md:space-y-7 pb-2">
      {categories.map((category) => (
        <div key={category} className="space-y-4 md:space-y-5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg md:text-xl font-bold text-primary capitalize">{category}</h2>
            <span className="text-xs md:text-sm text-muted-foreground tabular-nums">{groupedProducts[category].length} items</span>
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
            {groupedProducts[category].map((product) => {
              const stock = product.currentStock ?? product.stock
              const isOutOfStock = stock === 0
              return (
                <Card
                  key={product.id}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-3xl border border-primary/15 bg-card/95 shadow-[0_1px_1px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                  onClick={() => onProductClick(product)}
                >
                  {/* Product Image */}
                  {product.image ? (
                    <div className="relative h-40 w-full overflow-hidden bg-white sm:h-40 md:h-45">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-muted text-muted-foreground sm:h-36 md:h-40">
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl">📦</div>
                        <p className="text-xs mt-1">No image</p>
                      </div>
                    </div>
                  )}

                  <CardContent className="flex flex-1 flex-col space-y-4 p-4 sm:p-5">
                    {/* Product Info */}
                    <div className="flex-1">
                      <p className="text-xs sm:text-[13px] text-muted-foreground font-mono line-clamp-1">{product.code}</p>
                      <h3 className="font-semibold text-base sm:text-[17px] text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                        {product.name}
                      </h3>
                    </div>

                    {/* Price and Stock */}
                    <div className="space-y-3 border-t border-primary/10 pt-3">
                      <div className="flex justify-between items-center gap-1">
                        <span className="text-base sm:text-lg font-bold text-primary truncate">
                          ₱{(product.minPrice ?? product.price).toFixed(2)}
                        </span>
                        <span className={`text-xs px-2 sm:px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap flex-shrink-0 ${
                          isOutOfStock
                            ? 'bg-red-500/20 text-red-600'
                            : stock <= 5
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {isOutOfStock ? 'Out' : stock <= 5 ? 'Low' : stock}
                        </span>
                      </div>

                      {/* Add Button */}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          onProductClick(product)
                        }}
                        disabled={isOutOfStock}
                        className="h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 group-hover:shadow-md disabled:opacity-50"
                      >
                        <Plus className="h-3 w-3 mr-1" />
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
          <p className="text-lg font-semibold">No products found</p>
          <p className="text-sm">Try adjusting your search</p>
        </div>
      )}
    </div>
  )
}
