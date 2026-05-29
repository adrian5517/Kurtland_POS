'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Search, ShoppingBag, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import POSProductGrid, { type POSProduct } from '@/components/pos/product-grid'
import POSCart from '@/components/pos/cart'
import ProductSelector from '@/components/pos/product-selector'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often to silently re-fetch products while the tab is visible (ms). */
const POLL_INTERVAL_MS = 15_000

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Raw shape returned by GET /api/products.
 *
 * DB column semantics (confirmed from schema screenshot):
 *   price      → cost / supplier price (what the business pays)
 *   srp_price  → suggested retail price (what the customer pays)
 */
type ApiProduct = {
  id: number
  name: string
  sku: string
  category: string
  /** Cost price — NOT shown on POS; used for analytics only */
  price: string
  /** Retail / selling price — this is what gets charged at checkout */
  srp_price: string
  quantity: number
  is_active: boolean
  image_url: string | null
  image_public_id: string | null
  created_at: string
}

type CheckoutPayload = {
  items: Array<{
    id: string
    name: string
    price: number
    quantity: number
    subtotal: number
  }>
  totalAmount: number
  amountPaid: number
}

type ReceiptTransaction = {
  transactionId: string
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>
  total: number
  amountPaid: number
  change: number
  cashierName: string
  timestamp: string
}

type CartItem = {
  id: string
  code: string
  name: string
  /** Retail price charged to the customer */
  price: number
  quantity: number
  subtotal: number
  /** Tracked so we can cap quantity at available stock */
  maxStock: number
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Maps a raw API product to the POSProduct shape consumed by child components.
 *
 * Price mapping:
 *   retailPrice ← srp_price  (what the customer sees and pays)
 *   costPrice   ← price      (internal; passed along but not displayed on POS grid)
 *
 * Falls back gracefully when srp_price is 0 or missing — the product will show
 * ₱0.00 and the cashier can correct it rather than crashing.
 */
function mapApiProduct(raw: ApiProduct): POSProduct {
  const parsedSrp = Number(raw.srp_price)
  const parsedCost = Number(raw.price)
  const retailPrice = Number.isFinite(parsedSrp) && parsedSrp > 0 ? parsedSrp : Number.isFinite(parsedCost) ? parsedCost : 0
  const costPrice = Number.isFinite(parsedCost) ? parsedCost : 0

  return {
    id: String(raw.id),
    code: raw.sku || '',
    name: raw.name || 'Unnamed product',
    category: raw.category || 'Products',
    // POSProduct.price is the POS-facing (retail) price
    price: retailPrice,
    // Preserve both price points so analytics / receipts can use them
    minPrice: costPrice,
    maxPrice: retailPrice,
    currentStock: raw.quantity ?? 0,
    stock: raw.quantity ?? 0,
    image: raw.image_url,
    isActive: raw.is_active ?? true,
  }
}

// ─── Custom hook: product loading ─────────────────────────────────────────────

/**
 * Encapsulates all product-fetching concerns:
 *   • Initial load on mount
 *   • Tab visibility re-fetch (focus + visibilitychange)
 *   • Periodic polling every POLL_INTERVAL_MS
 *   • AbortController so in-flight requests are cancelled on unmount,
 *     preventing state updates on dead components and race conditions
 *     between concurrent fetches
 *   • Silent refresh mode (no loading spinner for background polls)
 */
function useProducts() {
  const [products, setProducts] = useState<POSProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSilentRefreshing, setIsSilentRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep a ref to the latest controller so the interval callback always
  // cancels the right request even after re-renders.
  const abortRef = useRef<AbortController | null>(null)

  const fetchProducts = useCallback(async (silent = false) => {
    const session = getAuthSession()
    if (!session?.token) {
      setError('Please sign in again to load products.')
      setIsLoading(false)
      return
    }

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (silent) {
      setIsSilentRefreshing(true)
    } else {
      setIsLoading(true)
      setError(null)
    }

    try {
      const response = await apiFetch('/api/products', {
        headers: apiHeaders(session.token),
        signal: controller.signal,
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load products')
      }

      const mapped = Array.isArray(payload.data)
        ? payload.data.map(mapApiProduct)
        : []

      setProducts(mapped)
      setError(null)
    } catch (err) {
      // AbortError is expected during cleanup — don't surface it as an error
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setIsLoading(false)
      setIsSilentRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    void fetchProducts(false)
  }, [fetchProducts])

  // Background polling + visibility-based refresh
  useEffect(() => {
    const controller = new AbortController()

    const silentRefresh = () => {
      if (document.visibilityState === 'visible') void fetchProducts(true)
    }

    window.addEventListener('focus', silentRefresh)
    document.addEventListener('visibilitychange', silentRefresh)

    const intervalId = window.setInterval(silentRefresh, POLL_INTERVAL_MS)

    return () => {
      controller.abort()
      window.removeEventListener('focus', silentRefresh)
      document.removeEventListener('visibilitychange', silentRefresh)
      window.clearInterval(intervalId)
      // Cancel any request still in-flight on unmount
      abortRef.current?.abort()
    }
  }, [fetchProducts])

  return {
    products,
    isLoading,
    isSilentRefreshing,
    error,
    /** Force a manual re-fetch (e.g. after checkout) */
    refresh: () => void fetchProducts(true),
  }
}

// ─── Custom hook: cart ────────────────────────────────────────────────────────

/**
 * Self-contained cart logic so POSDashboard's render body stays readable.
 *
 * Key invariants enforced here:
 *   • Inactive products cannot be added
 *   • Out-of-stock products cannot be added
 *   • Cart quantity is capped at currentStock — prevents over-ordering
 *   • Removing an item with quantity already 0 is a no-op (safety guard)
 */
function useCart(products: POSProduct[]) {
  const [cart, setCart] = useState<CartItem[]>([])
  // Stable ref that always mirrors the latest cart without widening useCallback
  // dependency arrays. Reading `.current` before setCart gives a synchronous
  // snapshot of state that TypeScript CAN reason about (unlike a let variable
  // mutated inside a setState updater, which produces `never` on optional call).
  const cartRef = useRef(cart)
  cartRef.current = cart

  /**
   * Look up the live product snapshot from the products list.
   * This matters for polling — stock may have changed since the item was
   * added, so we always validate against the freshest server value.
   */
  const getProduct = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products],
  )

  const addToCart = useCallback(
    (product: POSProduct) => {
      if (!product.isActive) {
        toast.error(`${product.name} is not available`)
        return
      }
      if (product.currentStock <= 0) {
        toast.error(`${product.name} is out of stock`)
        return
      }

      // Determine the notification from the latest cart snapshot BEFORE the
      // state update. This gives TypeScript a concrete type for `notifyFn`
      // (avoids the `never` narrowing that occurs when mutating a variable
      // inside a setState callback) and keeps the updater below side-effect-free
      // (safe under React 18 Strict Mode's double-invocation of updaters).
      const existing = cartRef.current.find((item) => item.id === product.id)
      let notifyFn: () => void

      if (existing) {
        notifyFn =
          existing.quantity >= product.currentStock
            ? () => toast.warning(`Only ${product.currentStock} units available`)
            : () => toast.success(`${product.name} qty updated`)
      } else {
        notifyFn = () => toast.success(`${product.name} added`)
      }

      // Pure updater — reads only `prev`, zero side-effects
      setCart((prev) => {
        const ex = prev.find((item) => item.id === product.id)
        if (ex) {
          if (ex.quantity >= product.currentStock) return prev
          return prev.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
              : item,
          )
        }
        return [
          ...prev,
          {
            id: product.id,
            code: product.code,
            name: product.name,
            price: product.price,
            quantity: 1,
            subtotal: product.price,
            maxStock: product.currentStock,
          },
        ]
      })

      notifyFn()
    },
    [],
  )

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId))
    toast.info('Item removed')
  }, [])

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId)
        return
      }

      // Resolve all constraints before the state update so the updater is pure
      // and `notifyFn` has a concrete type (no `never` from CFA across closures).
      const currentItem = cartRef.current.find((i) => i.id === productId)
      const liveProduct = getProduct(productId)
      const maxQty = liveProduct?.currentStock ?? currentItem?.maxStock ?? quantity
      const clampedQty = Math.min(quantity, maxQty)
      const notifyFn: (() => void) | null =
        currentItem && clampedQty < quantity
          ? () => toast.warning(`Only ${maxQty} units available for ${currentItem.name}`)
          : null

      // Pure updater — only prev → next, no external reads or mutations
      setCart((prev) =>
        prev.map((item) =>
          item.id !== productId
            ? item
            : { ...item, quantity: clampedQty, subtotal: clampedQty * item.price },
        ),
      )

      notifyFn?.()
    },
    [removeFromCart, getProduct],
  )

  const clearCart = useCallback(() => setCart([]), [])

  /**
   * Sync cart items' maxStock whenever the products list refreshes.
   * Also automatically reduce quantity if stock dropped below current qty
   * (e.g. another cashier sold items since the product was added).
   */
  useEffect(() => {
    if (!products.length) return
    setCart((prev) =>
      prev
        .map((item) => {
          const live = products.find((p) => p.id === item.id)
          if (!live) return item
          const newMax = live.currentStock
          const newQty = Math.min(item.quantity, newMax)
          return {
            ...item,
            maxStock: newMax,
            quantity: newQty,
            subtotal: newQty * item.price,
          }
        })
        // Remove items whose product no longer exists (deleted from inventory)
        .filter((item) => products.some((p) => p.id === item.id)),
    )
  }, [products])

  return { cart, addToCart, removeFromCart, updateQuantity, clearCart }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function POSDashboard() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false)
  const [showInactiveProducts, setShowInactiveProducts] = useState(false)
  // Ref for the mobile cart drawer — used to auto-scroll to newest item
  const drawerRef = useRef<HTMLDivElement>(null)

  // ── Data ─────────────────────────────────────────────────────────────────────
  const {
    products,
    isLoading: isLoadingProducts,
    isSilentRefreshing,
    error: productError,
    refresh: refreshProducts,
  } = useProducts()

  const { cart, addToCart, removeFromCart, updateQuantity, clearCart } = useCart(products)

  // ── Derived cart values ───────────────────────────────────────────────────────
  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart])

  // ── Auto-expand / collapse mobile cart ───────────────────────────────────────
  useEffect(() => {
    if (cart.length === 1) setMobileCartExpanded(true)  // expand when first item added
    if (cart.length === 0) setMobileCartExpanded(false) // collapse when cart cleared
  }, [cart.length])

  // After the drawer height transitions (300ms), scroll it to show the newest item
  // and the checkout footer. Safe no-op on desktop (drawerRef targets mobile-only element).
  useEffect(() => {
    if (!mobileCartExpanded || cart.length === 0) return
    const id = setTimeout(() => {
      drawerRef.current?.scrollTo({ top: drawerRef.current.scrollHeight, behavior: 'smooth' })
    }, 320)
    return () => clearTimeout(id)
  }, [cart.length, mobileCartExpanded])

  // ── Derived data ─────────────────────────────────────────────────────────────

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products],
  )

  /**
   * Memoized so it doesn't re-run on cart updates, animation frames, or
   * any state change unrelated to the filter inputs.
   */
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (!showInactiveProducts && !product.isActive) return false

        const q = searchQuery.toLowerCase()
        const matchesSearch =
          !q ||
          product.name.toLowerCase().includes(q) ||
          product.code.toLowerCase().includes(q)

        const matchesCategory =
          activeCategory === 'All' || product.category === activeCategory

        return matchesSearch && matchesCategory
      }),
    [products, showInactiveProducts, searchQuery, activeCategory],
  )

  // ── Checkout ─────────────────────────────────────────────────────────────────

  /**
   * Handles checkout by POSTing to /api/orders.
   *
   * Design: throws on failure so POSCart can display its own inline error
   * state (it owns the modal/form context). The dashboard catches the
   * non-throwing path and resets cart + refreshes products.
   *
   * The response is returned so POSCart can render a receipt without needing
   * direct API access.
   */
  const handleCheckout = useCallback(
    async (payload: CheckoutPayload): Promise<ReceiptTransaction> => {
      const session = getAuthSession()
      if (!session?.token) {
        throw new Error('Your session expired. Please sign in again.')
      }

      const response = await apiFetch('/api/orders', {
        method: 'POST',
        headers: {
          ...Object.fromEntries(apiHeaders(session.token).entries()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const body = await response.json()

      if (!response.ok) {
        throw new Error(body?.message || body?.error || 'Checkout failed. Please try again.')
      }

      // Only clear + refresh after a confirmed successful order
      clearCart()
      refreshProducts()

      return body.data as ReceiptTransaction
    },
    [clearCart, refreshProducts],
  )

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none overflow-hidden lg:min-h-full lg:overflow-visible">
      <div className="flex h-full min-h-0 w-full max-w-none flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:grid lg:p-8 xl:grid-cols-[minmax(0,1.25fr)_20rem] 2xl:grid-cols-[minmax(0,1.35fr)_24rem]">

        {/* ── Products panel ── */}
        <motion.section
          className={[
            'flex min-h-0 min-w-0 flex-1 flex-col gap-4',
            'rounded-3xl border border-border/50 bg-background/80',
            'p-4 shadow-sm backdrop-blur-sm sm:p-5 lg:p-6',
            mobileCartExpanded
              ? 'pb-[95dvh]'
              : 'pb-20',
            'lg:pb-6',
          ].join(' ')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between flex-shrink-0">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                Kurtland POS
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Menu
              </h1>
              <p className="text-sm text-muted-foreground">
                Search, filter, and add items to the current order.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start xl:self-auto">
              {/* Item count + silent refresh indicator */}
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
                {isLoadingProducts
                  ? 'Loading…'
                  : `${filteredProducts.length} items`}
                {isSilentRefreshing && (
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground/60" />
                )}
              </span>

              {/* Manual refresh (useful when stock is known to have changed) */}
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl shrink-0"
                title="Refresh products"
                onClick={refreshProducts}
                disabled={isLoadingProducts}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingProducts ? 'animate-spin' : ''}`} />
              </Button>

              {/* Mobile: open full-screen product selector */}
              <Button
                onClick={() => setShowProductSelector(true)}
                className="lg:hidden gap-2 h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all"
              >
                <ShoppingBag className="h-4 w-4" />
                Browse
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {productError && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{productError}</span>
              <button
                onClick={refreshProducts}
                className="text-xs font-semibold underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative flex-shrink-0 group">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="text"
              placeholder="Search by name or code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card border-border/60 focus:border-primary/40 rounded-xl text-sm transition-all duration-200 focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Inactive toggle */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Switch
                checked={showInactiveProducts}
                onCheckedChange={setShowInactiveProducts}
              />
              <span>Show inactive products</span>
            </label>
            {!showInactiveProducts && (
              <p className="text-xs text-muted-foreground">
                Inactive products are hidden from the POS menu.
              </p>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap flex-shrink-0">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                whileTap={{ scale: 0.96 }}
                className={[
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide',
                  'transition-all duration-200 border',
                  activeCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                    : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                {cat}
              </motion.button>
            ))}
          </div>

          {/* Product grid */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 -mr-1 lg:pr-2">
            <POSProductGrid
              products={filteredProducts}
              onProductClick={addToCart}
            />
          </div>
        </motion.section>

        {/* ── Desktop cart sidebar ── */}
        <motion.aside
          className="hidden min-h-0 min-w-0 flex-col gap-3 lg:flex xl:sticky xl:top-0 xl:self-start xl:h-[calc(100vh-8rem)] 2xl:gap-4"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <POSCart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
            className="flex-1 min-h-0"
          />
        </motion.aside>
      </div>

      {/* ── Mobile cart drawer ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div
          ref={drawerRef}
          className={[
            'overflow-y-auto overflow-x-hidden rounded-t-3xl border-x border-t border-border/50',
            'bg-card/98 shadow-2xl shadow-black/15 backdrop-blur-md',
            'transition-[height] duration-300 ease-in-out',
          ].join(' ')}
          // Height formula (measured at compact density):
          //   handle 56 + cart-header 56 + items-padding 20 + footer 284 = 416 base
          //   each item row: name(32) + qty(28) + p-2(16) + gap(8)      = 84 per item
          // Items always visible; drawer itself scrolls when > 95dvh (4+ items on small phones).
          // The sticky handle stays visible regardless of scroll position.
          style={{
            height:
              !mobileCartExpanded || cart.length === 0
                ? '3.5rem'
                : `min(${416 + cart.length * 84}px, 95dvh)`,
          }}
        >
          {/* Summary handle — tappable bar showing count + total */}
          <button
            type="button"
            onClick={() => cart.length > 0 && setMobileCartExpanded((v) => !v)}
            className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border/40 w-full text-left active:bg-muted/40 bg-card/98 backdrop-blur-md transition-colors"
            aria-label={mobileCartExpanded ? 'Collapse cart' : 'Expand cart'}
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground leading-none">
                  {cart.length > 0 ? `${cartItemCount} item${cartItemCount !== 1 ? 's' : ''}` : 'Current Order'}
                </p>
                {cart.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {mobileCartExpanded ? 'Tap to collapse' : 'Tap to expand'}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {cart.length > 0 && (
                <span className="text-sm font-black text-primary tabular-nums">₱{cartTotal.toFixed(2)}</span>
              )}
              <div className="h-1 w-8 rounded-full bg-muted-foreground/25" />
            </div>
          </button>

          {/* Cart renders at its natural height — no h-full, no wrapper */}
          <POSCart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            onClearCart={clearCart}
            compact
          />
        </div>
      </div>

      {/* ── Full-screen product selector (mobile) ── */}
      <AnimatePresence>
        {showProductSelector && (
          <ProductSelector
            products={filteredProducts}
            onProductClick={addToCart}
            onClose={() => setShowProductSelector(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}