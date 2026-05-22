'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Trash2, Minus, Plus, ShoppingBag, ReceiptText } from 'lucide-react'
import Receipt from './receipt'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  subtotal: number
}

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
  onCheckout: (payload: {
    items: CartItem[]
    totalAmount: number
    amountPaid: number
  }) => Promise<ReceiptTransaction>
  onClearCart?: () => void
  className?: string
  compact?: boolean
}

interface ReceiptTransaction {
  transactionId: string
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>
  total: number
  amountPaid: number
  change: number
  cashierName: string
  timestamp: string
}

export default function POSCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onClearCart,
  className,
  compact = false,
}: CartProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<ReceiptTransaction | null>(null)
  const [amountPaid, setAmountPaid] = useState(0)

  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const change = Math.max(amountPaid - total, 0)

  useEffect(() => {
    setAmountPaid((currentAmountPaid) => {
      if (currentAmountPaid < total) {
        return total
      }
      return currentAmountPaid
    })
  }, [total])

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error('Cart is empty')
      return
    }

    if (amountPaid < total) {
      toast.error(`Amount paid must be at least ₱${total.toFixed(2)}`)
      return
    }

    setIsCheckingOut(true)

    try {
      const transaction = await onCheckout({ items, totalAmount: total, amountPaid })
      setLastTransaction(transaction)
      setShowReceipt(true)
      toast.success(`Order complete — change ₱${transaction.change.toFixed(2)}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout failed')
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <>
      <Card
        className={`flex flex-col border-border/50 bg-card shadow-sm overflow-hidden ${
          compact ? 'h-full min-h-0 rounded-t-3xl rounded-b-none border-b-0' : 'h-full min-h-[28rem] rounded-3xl'
        } ${className ?? ''}`}
      >
        {/* Header */}
        <CardHeader className={`flex-shrink-0 border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent ${compact ? 'px-4 py-3.5' : 'px-5 py-5'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`${compact ? 'w-8 h-8 rounded-xl' : 'w-9 h-9 rounded-2xl'} bg-primary/10 flex items-center justify-center flex-shrink-0`}>
                <ShoppingBag className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-primary`} />
              </div>
              <div className="min-w-0">
                <h2 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-foreground leading-none truncate`}>Current Order</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? 's' : ''}` : 'Empty'}
                </p>
              </div>
            </div>
            {items.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => {
                  onClearCart?.()
                  toast.info('Cart cleared')
                }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors py-1 px-2 rounded-lg hover:bg-destructive/5"
              >
                Clear all
              </motion.button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
          {/* Cart Items */}
          <div className={`${compact ? 'flex-1 overflow-y-auto px-3 py-2.5 space-y-2 min-h-0' : 'flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0'}`}>
            <AnimatePresence initial={false}>
              {items.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`flex flex-col items-center justify-center text-center ${compact ? 'py-4' : 'py-16'}`}
                >
                  <div className={`${compact ? 'w-12 h-12 rounded-2xl' : 'w-16 h-16 rounded-3xl'} bg-muted flex items-center justify-center mb-3`}>
                    <ShoppingBag className={`${compact ? 'h-5 w-5' : 'h-7 w-7'} text-muted-foreground/40`} />
                  </div>
                  <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>No items yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Select from the menu to begin</p>
                </motion.div>
              ) : (
                items.map((item, i) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -16, scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`bg-muted/50 hover:bg-muted/80 border border-border/30 rounded-2xl transition-colors ${compact ? 'p-2' : 'p-3'}`}
                  >
                    <div className={`flex items-start justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2.5'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`${compact ? 'text-[11px]' : 'text-sm'} font-semibold text-foreground truncate`}>{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">₱{item.price.toFixed(2)} each</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => onRemoveItem(item.id)}
                        className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all flex-shrink-0`}
                      >
                        <Trash2 className={`${compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'}`} />
                      </motion.button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} rounded-xl border border-border/60 bg-background flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-all`}
                        >
                          <Minus className={`${compact ? 'h-2 w-2' : 'h-3 w-3'}`} />
                        </motion.button>
                        <span className={`${compact ? 'w-6 text-[11px]' : 'w-8 text-sm'} text-center font-bold tabular-nums`}>{item.quantity}</span>
                        <motion.button
                          whileTap={{ scale: 0.88 }}
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} rounded-xl border border-border/60 bg-background flex items-center justify-center hover:border-primary/40 hover:bg-primary/5 transition-all`}
                        >
                          <Plus className={`${compact ? 'h-2 w-2' : 'h-3 w-3'}`} />
                        </motion.button>
                      </div>
                      <span className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-primary tabular-nums`}>₱{item.subtotal.toFixed(2)}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Footer / Summary */}
          <div className={`border-t border-border/40 space-y-3 flex-shrink-0 ${compact ? 'px-3 pb-2.5 pt-2' : 'px-4 pb-4 pt-3'}`}>
            {/* Subtotals */}
            {items.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`space-y-1.5 text-sm ${compact ? 'mb-0.5' : ''}`}
              >
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({itemCount} items)</span>
                  <span className="tabular-nums">₱{total.toFixed(2)}</span>
                </div>
              </motion.div>
            )}

            <div className={`${compact ? 'grid grid-cols-1 gap-2' : 'space-y-2'}`}>
              <label className={`block text-xs font-semibold uppercase tracking-wider text-muted-foreground ${compact ? 'mt-0' : ''}`}>
                Amount Paid
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={amountPaid === 0 ? '' : amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value || 0))}
                placeholder={`₱${total.toFixed(2)}`}
                className={`${compact ? 'h-10' : 'h-11'} rounded-xl border-border/60 bg-background text-sm font-medium tabular-nums`}
              />
              <div className={`flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 ${compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
                <span className="font-medium text-emerald-700">Change</span>
                <span className="font-bold text-emerald-700 tabular-nums">₱{change.toFixed(2)}</span>
              </div>
            </div>

            {/* Total */}
            <div className={`bg-primary rounded-2xl ${compact ? 'p-2.5' : 'p-4'}`}>
              <div className="flex items-end justify-between">
                <div>
                  <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-primary-foreground/70 font-medium uppercase tracking-wider`}>Total</p>
                  <motion.p
                    key={total}
                    initial={{ scale: 0.96, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-primary-foreground tabular-nums mt-0.5`}
                  >
                    ₱{total.toFixed(2)}
                  </motion.p>
                </div>
                <ReceiptText className={`${compact ? 'h-6 w-6' : 'h-8 w-8'} text-primary-foreground/20`} />
              </div>
            </div>

            {/* Checkout Button */}
            <motion.button
              whileTap={{ scale: items.length === 0 ? 1 : 0.97 }}
              onClick={handleCheckout}
              disabled={items.length === 0 || isCheckingOut || amountPaid < total}
              className={`w-full rounded-2xl font-semibold bg-foreground text-background disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${compact ? 'h-11 text-xs' : 'h-12 text-sm'}`}
            >
              {isCheckingOut ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing…
                </>
              ) : (
                <>
                  <ReceiptText className="h-4 w-4" />
                  Complete Order {amountPaid > total ? `• Change ₱${change.toFixed(2)}` : ''}
                </>
              )}
            </motion.button>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && lastTransaction && (
          <Receipt
            transactionId={lastTransaction.transactionId}
            items={lastTransaction.items}
            subtotal={lastTransaction.total}
            total={lastTransaction.total}
            amountPaid={lastTransaction.amountPaid}
            change={lastTransaction.change}
            cashierName={lastTransaction.cashierName}
            timestamp={lastTransaction.timestamp}
            onClose={() => setShowReceipt(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}