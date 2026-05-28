'use client'

import { AlertCircle, TrendingDown, PackageX, ChevronRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface LowStockProduct {
  id: string
  code: string
  name: string
  currentStock: number
  minStock: number
  percentageRemaining: number
}

interface StockWarningProps {
  lowStockProducts: LowStockProduct[]
  onRestock?: (productId: string, productName: string) => void
}

/**
 * Out of Stock Item Component
 * Displays individual items that are completely out of stock
 */
function OutOfStockItem({ item, onRestock }: { item: LowStockProduct; onRestock?: (id: string, name: string) => void }) {
  return (
    <div className="group flex items-center justify-between gap-4 p-4 rounded-lg border border-red-200/50 bg-gradient-to-r from-red-50/50 to-transparent hover:bg-gradient-to-r hover:from-red-100/50 hover:to-transparent transition-all duration-200 ease-out">
      {/* Product Info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center border border-red-200">
          <PackageX className="h-5 w-5 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-red-700 transition-colors">
            {item.name}
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">SKU: {item.code}</p>
        </div>
      </div>

      {/* Status Badge + Restock Button */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge 
          variant="destructive" 
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 font-semibold text-xs rounded-full shadow-sm"
        >
          OUT OF STOCK
        </Badge>
        {onRestock && (
          <Button
            size="sm"
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 rounded-lg transition-colors"
            onClick={() => onRestock(item.id, item.name)}
            title="Restock product"
          >
            <Plus className="h-3.5 w-3.5" />
            Restock
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Low Stock Item Component
 * Displays items running low on stock with visual progress indicator
 */
function LowStockItem({ item }: { item: LowStockProduct }) {
  const stockPercentage = (item.currentStock / item.minStock) * 100

  return (
    <div className="group flex items-start justify-between gap-4 p-4 rounded-lg border border-amber-200/50 bg-gradient-to-r from-amber-50/50 to-transparent hover:bg-gradient-to-r hover:from-amber-100/50 hover:to-transparent transition-all duration-200 ease-out">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-amber-700 transition-colors">
            {item.name}
          </h4>
          <Badge 
            variant="secondary" 
            className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 font-medium rounded-full"
          >
            {item.currentStock}/{item.minStock} units
          </Badge>
        </div>

        {/* Stock Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden border border-gray-300/50">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${Math.min(stockPercentage, 100)}%` }}
              role="progressbar"
              aria-valuenow={item.currentStock}
              aria-valuemin={0}
              aria-valuemax={item.minStock}
            />
          </div>
          <p className="text-xs text-gray-600 font-medium">
            {item.percentageRemaining.toFixed(0)}% of minimum stock level
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Caution Stock Item Component
 * Displays items below 50% stock level with visual indicators
 */
function CautionStockItem({ item }: { item: LowStockProduct }) {
  return (
    <div className="group flex items-start justify-between gap-4 p-4 rounded-lg border border-orange-200/50 bg-gradient-to-r from-orange-50/50 to-transparent hover:bg-gradient-to-r hover:from-orange-100/50 hover:to-transparent transition-all duration-200 ease-out">
      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900 truncate group-hover:text-orange-700 transition-colors">
            {item.name}
          </h4>
          <Badge 
            variant="secondary" 
            className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 font-medium rounded-full"
          >
            {item.currentStock} units
          </Badge>
        </div>

        {/* Stock Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden border border-gray-300/50">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${item.percentageRemaining}%` }}
              role="progressbar"
              aria-valuenow={item.currentStock}
              aria-valuemin={0}
              aria-valuemax={item.minStock}
            />
          </div>
          <p className="text-xs text-gray-600 font-medium">
            {item.percentageRemaining.toFixed(0)}% stock remaining
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Stock Warning Alert Container
 * Professional inventory status display with categorized stock levels
 */
export default function StockWarning({ lowStockProducts, onRestock }: StockWarningProps) {
  if (lowStockProducts.length === 0) {
    return null
  }

  const criticalItems = lowStockProducts.filter(p => p.currentStock === 0)
  const warningItems = lowStockProducts.filter(p => p.currentStock > 0 && p.percentageRemaining <= 25)
  const cautionItems = lowStockProducts.filter(p => p.percentageRemaining > 25 && p.percentageRemaining <= 50)

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* ─── Out of Stock Alert ─────────────────────────────────────────────────── */}
      {criticalItems.length > 0 && (
        <Card className="border-red-200/60 bg-gradient-to-br from-red-50/50 via-red-50/30 to-white shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-red-200/30 bg-gradient-to-r from-red-50/80 to-transparent">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center border border-red-200/50 shadow-sm">
                  <PackageX className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <CardTitle className="text-red-700 text-lg font-bold">Out of Stock</CardTitle>
                  <p className="text-xs text-red-600/70 font-medium mt-1">
                    Immediate action required
                  </p>
                </div>
              </div>
              <Badge className="bg-red-600 text-white font-bold text-sm px-3 py-1 rounded-lg shadow-md">
                {criticalItems.length} item{criticalItems.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 px-6 pb-6">
            <div className="space-y-3">
              {criticalItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="animate-in fade-in slide-in-from-top-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <OutOfStockItem item={item} onRestock={onRestock} />
                </div>
              ))}
            </div>

            {/* Action Hint */}
            <div className="mt-4 p-3 rounded-lg bg-red-100/40 border border-red-200/40 flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>These products are completely out of stock and should be reordered immediately.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Low Stock Warning ──────────────────────────────────────────────────── */}
      {warningItems.length > 0 && (
        <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 via-amber-50/30 to-white shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-amber-200/30 bg-gradient-to-r from-amber-50/80 to-transparent">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center border border-amber-200/50 shadow-sm">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-amber-700 text-lg font-bold">Low Stock</CardTitle>
                  <p className="text-xs text-amber-600/70 font-medium mt-1">
                    ≤25% of minimum level
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-600 text-white font-bold text-sm px-3 py-1 rounded-lg shadow-md">
                {warningItems.length} item{warningItems.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 px-6 pb-6">
            <div className="space-y-3">
              {warningItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="animate-in fade-in slide-in-from-top-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <LowStockItem item={item} />
                </div>
              ))}
            </div>

            {/* Action Hint */}
            <div className="mt-4 p-3 rounded-lg bg-amber-100/40 border border-amber-200/40 flex items-center gap-2 text-xs text-amber-700 font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Consider placing a reorder for these items soon to avoid stockouts.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Stock Caution ──────────────────────────────────────────────────────── */}
      {cautionItems.length > 0 && (
        <Card className="border-orange-200/60 bg-gradient-to-br from-orange-50/50 via-orange-50/30 to-white shadow-sm overflow-hidden">
          <CardHeader className="pb-4 border-b border-orange-200/30 bg-gradient-to-r from-orange-50/80 to-transparent">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center border border-orange-200/50 shadow-sm">
                  <TrendingDown className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-orange-700 text-lg font-bold">Stock Caution</CardTitle>
                  <p className="text-xs text-orange-600/70 font-medium mt-1">
                    25-50% of minimum level
                  </p>
                </div>
              </div>
              <Badge className="bg-orange-600 text-white font-bold text-sm px-3 py-1 rounded-lg shadow-md">
                {cautionItems.length} item{cautionItems.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4 px-6 pb-6">
            <div className="space-y-3">
              {cautionItems.map((item, index) => (
                <div 
                  key={item.id}
                  className="animate-in fade-in slide-in-from-top-2 duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CautionStockItem item={item} />
                </div>
              ))}
            </div>

            {/* Action Hint */}
            <div className="mt-4 p-3 rounded-lg bg-orange-100/40 border border-orange-200/40 flex items-center gap-2 text-xs text-orange-700 font-medium">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>Monitor these items closely and plan inventory replenishment as needed.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
