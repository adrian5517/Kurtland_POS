'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, X, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ReceiptItem {
  name: string
  quantity: number
  price: number
  subtotal: number
}

interface ReceiptProps {
  transactionId: string
  items: ReceiptItem[]
  subtotal: number
  total: number
  amountPaid: number
  change: number
  cashierName: string
  timestamp: string
  onClose: () => void
}

export default function Receipt({
  transactionId,
  items,
  subtotal,
  total,
  amountPaid,
  change,
  cashierName,
  timestamp,
  onClose,
}: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const now = new Date()

  const handlePrint = () => {
    if (!receiptRef.current) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow pop-ups for printing')
      return
    }

    const receiptHTML = receiptRef.current.innerHTML
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .receipt {
              max-width: 400px;
              margin: 0 auto;
              border: 1px solid #333;
              padding: 20px;
            }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { margin: 0 0 5px 0; font-size: 18px; }
            .header p { margin: 3px 0; font-size: 12px; color: #666; }
            .divider { border-top: 1px dashed #333; margin: 15px 0; }
            .item { display: flex; justify-content: space-between; font-size: 13px; margin: 8px 0; }
            .item-name { flex: 1; }
            .item-qty { text-align: center; width: 50px; }
            .item-price { text-align: right; width: 60px; }
            .totals { margin-top: 15px; }
            .total-row { display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0; }
            .final-total { display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 10px; border-top: 1px solid #333; padding-top: 10px; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            ${receiptHTML}
          </div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }



  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl max-h-[95vh] sm:max-h-[92vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* Close Button - Floating */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white rounded-full p-2 hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>

        {/* Success Header with Checkmark */}
        <div className="relative h-32 bg-gradient-to-r from-primary via-primary/95 to-primary flex items-center justify-center rounded-t-2xl overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/20" />
          </div>
          <div className="relative flex flex-col items-center space-y-2">
            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-500 delay-150">
              <Check className="h-8 w-8 text-primary font-bold" />
            </div>
            <p className="text-white text-sm sm:text-base font-semibold">Order Completed</p>
          </div>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6 sm:p-8 space-y-6">
          {/* Transaction Header */}
          <div className="text-center space-y-3">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">KURTLAND</h3>
            <p className="text-xs sm:text-sm text-gray-500 font-medium">Canteen Management System</p>
            <div className="flex items-center justify-center gap-2 text-primary">
              <div className="h-px w-8 bg-primary/30" />
              <p className="text-xs sm:text-sm font-semibold">Receipt #{transactionId}</p>
              <div className="h-px w-8 bg-primary/30" />
            </div>
          </div>

          {/* Transaction Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Date & Time:</span>
              <span className="font-semibold text-gray-900">{timestamp}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Cashier:</span>
              <span className="font-semibold text-gray-900">{cashierName}</span>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider">Order Items</div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-sm sm:text-base font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">₱{item.price.toFixed(2)} × {item.quantity}</p>
                  </div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900 ml-2">₱{item.subtotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Total Amount Card */}
          <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-2 border-primary/20 rounded-xl p-5 text-center">
            <p className="text-xs sm:text-sm text-gray-600 mb-2 font-medium uppercase tracking-wide">Total Amount</p>
            <p className="text-4xl sm:text-5xl font-bold text-primary">₱{total.toFixed(2)}</p>
          </div>

          {/* Payment Summary */}
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Amount Paid:</span>
              <span className="text-sm sm:text-base font-semibold text-gray-900">₱{amountPaid.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 px-3 bg-green-50 border-2 border-green-200 rounded-lg">
              <span className="text-sm font-medium text-green-700">Change:</span>
              <span className="text-lg sm:text-xl font-bold text-green-600">₱{change.toFixed(2)}</span>
            </div>
          </div>

          {/* Thank You Message */}
          <div className="text-center space-y-2 pt-4 border-t-2 border-gray-100">
            <p className="text-sm sm:text-base font-semibold text-gray-900">Thank you for your purchase!</p>
            <p className="text-xs sm:text-sm text-gray-500">Please visit us again</p>
            <p className="text-xs text-gray-400 pt-2 font-mono">✦ KEEP YOUR RECEIPT ✦</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 space-y-3 border-t border-gray-100">
          <Button
            onClick={handlePrint}
            className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-semibold h-12 sm:h-14 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Printer className="h-5 w-5" />
            <span className="hidden sm:inline">Print Receipt</span>
            <span className="sm:hidden">Print</span>
          </Button>
          <Button
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold h-11 sm:h-13 rounded-lg transition-all duration-200"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
