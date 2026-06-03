'use client'

import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Printer, X } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReceiptItem {
  name: string
  quantity: number
  price: number
  subtotal: number
}

/**
 * All data required to render and print the post-checkout receipt modal.
 * Mirrors the `ReceiptTransaction` shape returned by POST /api/orders.
 */
interface ReceiptProps {
  transactionId: string
  items: ReceiptItem[]
  /** Sum of item subtotals — retained for future discount line support */
  subtotal: number
  /** Final charged amount (equals subtotal when no discounts apply) */
  total: number
  amountPaid: number
  change: number
  /** Full name or email of the logged-in cashier */
  cashierName: string
  /** Pre-formatted timestamp string from the server */
  timestamp: string
  onClose: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL = '₱'

/** Formats a numeric value as a locale-consistent currency string. */
function fmt(value: number): string {
  return `${CURRENCY_SYMBOL}${value.toFixed(2)}`
}
/** Escapes special HTML characters to prevent injection in the print document. */
function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
/**
 * Builds a fully self-contained HTML document for the browser print window.
 * All styles are inlined so the output is independent of Tailwind or any
 * external stylesheet — ensuring correct rendering across all browsers.
 */
function buildPrintDocument(data: Omit<ReceiptProps, 'onClose'> & { logoUrl: string }): string {
  const insufficientPayment = data.amountPaid < data.total
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${escHtml(item.name)}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">${fmt(item.price)}</td>
        <td class="item-sub">${fmt(item.subtotal)}</td>
      </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<!-- Receipt v1.0 -->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=80mm, initial-scale=1" />
  <title>Receipt — ${escHtml(data.transactionId)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: 80mm auto;
      margin: 2mm 3mm;
    }

    html {
      width: 80mm;
    }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.45;
      background: #fff;
      color: #000;
      width: 74mm;
      max-width: 74mm;
      margin: 0 auto;
      padding: 2mm 0;
      word-break: break-word;
    }

    .wrap { width: 100%; }

    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: 700; }
    .num    { font-variant-numeric: tabular-nums; }

    /* Header */
    .header { text-align: center; margin-bottom: 4px; }
    .header-logo { width: 68px; height: 68px; object-fit: contain; display: block; margin: 0 auto 4px; filter: contrast(1.8); }
    .store-name { font-size: 14px; font-weight: 900; letter-spacing: 2.5px; margin-bottom: 1px; }
    .store-sub  { font-size: 11px; font-weight: 700; color: #000; letter-spacing: 0.5px; }

    /* Dividers */
    .dash { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .solid { border: none; border-top: 2px solid #000; margin: 4px 0; }

    /* Metadata rows */
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #000; margin: 2px 0; }
    .meta .meta-label { flex-shrink: 0; color: #000; font-weight: 700; }
    .meta .meta-value { font-weight: 700; color: #000; text-align: right; max-width: 52mm; word-break: break-word; }

    /* Section label */
    .label { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #000; margin: 6px 0 3px; }

    /* Items table — fixed layout so columns never overflow */
    table { width: 74mm; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
    col.col-item  { width: 34mm; }
    col.col-qty   { width: 8mm; }
    col.col-price { width: 16mm; }
    col.col-sub   { width: 16mm; }
    thead th {
      font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px;
      color: #000; padding: 3px 1px; border-bottom: 2px solid #000;
    }
    thead th:nth-child(1) { text-align: left; }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3), thead th:nth-child(4) { text-align: right; }
    td {
      padding: 3px 1px;
      border-bottom: 1px dotted #333;
      vertical-align: top;
      font-variant-numeric: tabular-nums;
      overflow: hidden;
    }
    td.item-name { text-align: left; white-space: normal; word-break: break-word; font-weight: 700; }
    td.item-qty  { text-align: center; font-weight: 800; }
    td.item-price { text-align: right; font-weight: 800; }
    td.item-sub  { text-align: right; font-weight: 900; }

    /* Totals */
    .totals-block { margin-top: 4px; }
    .total-row  { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; font-variant-numeric: tabular-nums; }
    .total-row .t-label { color: #000; font-weight: 700; }
    .total-row .t-value { font-weight: 900; }
    .grand {
      display: flex; justify-content: space-between;
      font-size: 16px; font-weight: 900;
      margin: 5px 0 3px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 4px 0;
      font-variant-numeric: tabular-nums;
    }
    .change-row {
      display: flex; justify-content: space-between;
      font-size: 14px; font-weight: 900;
      margin: 3px 0;
      font-variant-numeric: tabular-nums;
    }
    .change-row.warn { color: #cc0000; }

    /* Footer */
    .footer { text-align: center; font-size: 11px; color: #000; margin-top: 8px; line-height: 1.9; }
    .footer-thanks { font-family: Georgia, 'Times New Roman', serif; font-size: 12px; font-style: italic; font-weight: 700; color: #000; }
    .footer .tagline { font-size: 11px; font-weight: 900; letter-spacing: 2px; margin-top: 4px; color: #000; }
    .disclaimer {
      font-size: 11px; font-weight: 700; color: #000;
      border-top: 1px dashed #000;
      margin-top: 7px; padding-top: 5px;
      line-height: 1.8;
    }

    @media print {
      html { width: 80mm; }
      body {
        width: 74mm;
        margin: 0 auto;
        padding: 0;
      }
      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <img src="${data.logoUrl}" alt="Kurtland logo" class="header-logo" onerror="this.style.display='none'" />
      <p class="store-name">KURTLAND</p>
      <p class="store-sub">GRADESCHOOL INC. &mdash; CANTEEN</p>
    </div>
    <hr class="dash" />
    <div class="meta"><span class="meta-label">Transaction</span><span class="meta-value">${escHtml(data.transactionId)}</span></div>
    <div class="meta"><span class="meta-label">Date &amp; Time</span><span class="meta-value">${escHtml(data.timestamp)}</span></div>
    <div class="meta"><span class="meta-label">Cashier</span><span class="meta-value">${escHtml(data.cashierName)}</span></div>
    <hr class="dash" />
    <p class="label">Order Items</p>
    <table>
      <colgroup>
        <col class="col-item" />
        <col class="col-qty" />
        <col class="col-price" />
        <col class="col-sub" />
      </colgroup>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals-block">
      <hr class="solid" />
      <div class="grand"><span>TOTAL</span><span>${fmt(data.total)}</span></div>
      <div class="total-row"><span class="t-label">Amount Paid</span><span class="t-value">${fmt(data.amountPaid)}</span></div>
      <div class="change-row${insufficientPayment ? ' warn' : ''}"><span>${insufficientPayment ? 'INSUFFICIENT PAYMENT' : 'Change'}</span><span>${fmt(data.change)}</span></div>
    </div>
    <hr class="dash" />
    <div class="footer">
      <p class="footer-thanks">Thank you for your purchase!</p>
      <p class="footer-thanks">Please come again.</p>
      <p class="tagline">✦ KEEP YOUR RECEIPT ✦</p>
      <p class="disclaimer">Customer Copy Only<br />Not valid for official tax purposes</p>
    </div>
  </div>
</body>
</html>`
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  // ── Handlers ────────────────────────────────────────────────────────────────

  function handlePrint() {
    const win = window.open('', '_blank', 'width=420,height=750,resizable=yes')
    if (!win) {
      toast.error('Pop-ups are blocked — please allow them to print')
      return
    }
    const logoUrl = `${window.location.origin}/kurt_land_b%26w_reciept_logo.png`
    win.document.write(
      buildPrintDocument({ transactionId, items, subtotal, total, amountPaid, change, cashierName, timestamp, logoUrl }),
    )
    win.document.close()
    // Delay allows fonts and logo image to fully load before printing
    setTimeout(() => {
      win.focus()
      win.print()
    }, 600)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Order receipt"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Backdrop — clicking outside closes the modal */}
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />

      {/*
       * Receipt card
       * Always white — a receipt is a paper document (not affected by dark mode).
       * Mobile: slides up as a bottom sheet, fixed to 96dvh so it never overflows.
       * Desktop: intrinsic height capped at 90dvh; body section scrolls if the
       *   item list is very long (e.g. 10+ items). min-h-0 on the scroll area is
       *   required so the flex child can shrink below its content height.
       */}
      <article className="relative z-10 w-full max-w-sm bg-white text-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[96dvh] sm:max-h-[90dvh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">

        {/*
         * ── Compact horizontal banner ─────────────────────────────────────
         * Horizontal layout (icon + text + close) keeps the banner to ~56px
         * instead of the ~130px a vertical stack requires. This is the single
         * biggest factor in making the receipt fit at 100% zoom.
         */}
        <div className="relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary to-primary/85 text-white overflow-hidden shrink-0">
          {/* Decorative circle */}
          <span className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />

          {/* Check icon */}
          <div className="relative h-9 w-9 bg-white rounded-full flex items-center justify-center shadow-md shrink-0 animate-in zoom-in-50 duration-400">
            <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={2.5} />
          </div>

          {/* Title + transaction ID */}
          <div className="relative flex-1 min-w-0 leading-tight">
            <p className="font-bold text-sm">Order Completed!</p>
            <p className="text-white/65 text-xs font-mono truncate mt-0.5">{transactionId}</p>
          </div>

          {/* Close button — lives inside banner to save vertical space */}
          <button
            onClick={onClose}
            aria-label="Close receipt"
            className="relative p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Perforated tear line ──────────────────────────────────────────── */}
        <div aria-hidden="true" className="flex items-center shrink-0">
          <div className="h-3 w-3 rounded-full bg-gray-100 -translate-x-1.5 shrink-0 border border-gray-200" />
          <div className="flex-1 border-t-2 border-dashed border-gray-200" />
          <div className="h-3 w-3 rounded-full bg-gray-100 translate-x-1.5 shrink-0 border border-gray-200" />
        </div>

        {/* ── Scrollable receipt body ───────────────────────────────────────── */}
        {/*
         * min-h-0 is required: without it flex children default to min-height:auto
         * (= content size), which prevents shrinking and disables overflow scroll.
         */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-5 pt-3 pb-3 space-y-3">

            {/* Store header */}
            <div className="text-center">
              <Image
                src="/kurtland_logo.png"
                alt="Kurtland Grade School logo"
                width={72}
                height={72}
                className="mx-auto object-contain mb-1"
                priority
              />
              <h2 className="text-md font-black tracking-[0.2em] text-gray-900">KURTLAND GRADESCHOOL INC.</h2>
              <p className="text-[10px] text-gray-400 tracking-wider uppercase mt-0.5">
                Canteen Management System
              </p>
            </div>

            {/* Transaction metadata */}
            <dl className="bg-gray-50 rounded-lg px-3.5 py-2.5 space-y-1.5 text-xs">
              <MetaRow label="Date & Time" value={timestamp} />
              <MetaRow label="Cashier" value={cashierName} />
            </dl>

            {/* Items list */}
            <section aria-label="Ordered items">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-1.5">
                Order Items
              </p>
              <ul className="divide-y divide-gray-100" role="list">
                {items.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-400 tabular-nums">
                        {fmt(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
                      {fmt(item.subtotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* ── Totals block ─────────────────────────────────────────────── */}
            <div className="border-t-2 border-dashed border-gray-200 pt-3 space-y-2">

              {/* Grand total — prominent but space-efficient */}
              <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Total
                </span>
                <span className="text-2xl font-black text-primary tabular-nums">{fmt(total)}</span>
              </div>

              {/* Payment breakdown */}
              <dl className="space-y-1.5 text-xs px-0.5">
                <div className="flex justify-between text-gray-500">
                  <dt>Amount Paid</dt>
                  <dd className="font-semibold text-gray-800 tabular-nums">{fmt(amountPaid)}</dd>
                </div>
                <div className={`flex justify-between items-center rounded-lg px-3 py-1.5 ${
                    change < 0
                      ? 'bg-red-50 border border-red-200'
                      : 'bg-emerald-50 border border-emerald-200'
                  }`}>
                  <dt className={`font-medium ${change < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {change < 0 ? 'Insufficient Payment' : 'Change'}
                  </dt>
                  <dd className={`text-base font-black tabular-nums ${change < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(change)}</dd>
                </div>
              </dl>
            </div>

            {/* Footer */}
            <div className="text-center pb-1 space-y-0.5">
              <p className="text-xs font-semibold text-gray-700">Thank you for your purchase!</p>
              <p className="text-[10px] text-gray-400">Please come again</p>
              <p className="text-[9px] text-gray-300 pt-1 tracking-[0.25em] font-mono">
                ✦ KEEP YOUR RECEIPT ✦
              </p>
              <div className="mt-2 border border-dashed border-gray-300 rounded-md px-3 py-1.5">
                <p className="text-[10px] font-semibold text-gray-400 tracking-wide leading-snug">
                  Customer Copy Only<br />
                  Not valid for official tax purposes
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* ── Perforated tear line ──────────────────────────────────────────── */}
        <div aria-hidden="true" className="flex items-center shrink-0">
          <div className="h-3 w-3 rounded-full bg-gray-100 -translate-x-1.5 shrink-0 border border-gray-200" />
          <div className="flex-1 border-t-2 border-dashed border-gray-200" />
          <div className="h-3 w-3 rounded-full bg-gray-100 translate-x-1.5 shrink-0 border border-gray-200" />
        </div>

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white px-5 pt-3 pb-4 space-y-2">
          <Button
            onClick={handlePrint}
            className="w-full h-10 font-semibold rounded-xl gap-2 text-sm"
          >
            <Printer className="h-4 w-4 shrink-0" />
            Print Receipt
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full h-9 font-medium rounded-xl text-sm"
          >
            Done
          </Button>
        </div>
      </article>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A labeled definition row for the transaction metadata section.
 * Uses `<dt>` / `<dd>` semantics inside a `<dl>` container.
 */
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-gray-500 shrink-0">{label}</dt>
      <dd className="font-semibold text-gray-900 text-right">{value}</dd>
    </div>
  )
}
