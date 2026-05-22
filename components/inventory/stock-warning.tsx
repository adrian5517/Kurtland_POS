'use client'

import { AlertCircle, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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
}

export default function StockWarning({ lowStockProducts }: StockWarningProps) {
  if (lowStockProducts.length === 0) {
    return null
  }

  const criticalItems = lowStockProducts.filter(p => p.currentStock === 0)
  const warningItems = lowStockProducts.filter(p => p.currentStock > 0 && p.percentageRemaining <= 25)
  const cautionItems = lowStockProducts.filter(p => p.percentageRemaining > 25 && p.percentageRemaining <= 50)

  return (
    <div className="space-y-4">
      {/* Critical Stock Alert */}
      {criticalItems.length > 0 && (
        <Alert className="border-red-500/50 bg-red-500/10">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertTitle className="text-red-600 font-bold">Out of Stock!</AlertTitle>
          <AlertDescription className="text-red-600/90">
            <p className="mb-2">{criticalItems.length} product(s) are out of stock</p>
            <div className="space-y-1">
              {criticalItems.map(item => (
                <div key={item.id} className="text-sm p-2 bg-red-500/20 rounded flex justify-between items-center">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-xs bg-red-600 text-white px-2 py-1 rounded">OUT</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Low Stock Warning */}
      {warningItems.length > 0 && (
        <Alert className="border-secondary/50 bg-secondary/10">
          <AlertCircle className="h-5 w-5 text-secondary" />
          <AlertTitle className="text-secondary font-bold">Low Stock Warning!</AlertTitle>
          <AlertDescription className="text-secondary/90">
            <p className="mb-2">{warningItems.length} product(s) low on stock</p>
            <div className="space-y-1">
              {warningItems.map(item => (
                <div key={item.id} className="text-sm p-2 bg-secondary/20 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-xs">
                      {item.currentStock}/{item.minStock}
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-secondary h-full transition-all"
                      style={{ width: `${item.percentageRemaining}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Caution Stock */}
      {cautionItems.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <TrendingDown className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-600 font-bold">Stock Caution</AlertTitle>
          <AlertDescription className="text-amber-600/90">
            <p className="mb-2">{cautionItems.length} product(s) below 50% stock level</p>
            <div className="space-y-1">
              {cautionItems.map(item => (
                <div key={item.id} className="text-sm p-2 bg-amber-500/20 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-xs">
                      {item.currentStock} units
                    </span>
                  </div>
                  <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all"
                      style={{ width: `${item.percentageRemaining}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
