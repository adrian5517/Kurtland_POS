'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, ShoppingBag, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import POSProductGrid from '@/components/pos/product-grid'
import POSCart from '@/components/pos/cart'
import ProductSelector from '@/components/pos/product-selector'
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
  created_at: string
}

type Product = {
  id: string
  code: string
  name: string
  category: string
  minPrice: number
  maxPrice: number
  price: number
  currentStock: number
  stock: number
  image: string | null
}

type CheckoutPayload = {
  items: Array<{ id: string; name: string; price: number; quantity: number; subtotal: number }>
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

const CATEGORY_BY_PREFIX: Record<string, string> = {
  PIZ: 'Pizza',
  BRG: 'Burgers',
  DRK: 'Drinks',
  DES: 'Desserts',
  SAL: 'Salads',
  PAT: 'Pasta',
}

function inferCategory(code: string) {
  return CATEGORY_BY_PREFIX[code.slice(0, 3).toUpperCase()] || 'Products'
}

function mapProduct(product: ApiProduct): Product {
  const price = Number(product.price)

  return {
    id: String(product.id),
    code: product.sku,
    name: product.name,
    category: product.category || inferCategory(product.sku),
    minPrice: price,
    maxPrice: price,
    price,
    currentStock: product.quantity,
    stock: product.quantity,
    image: product.image_url,
  }
}

interface CartItem {
  id: string
  code: string
  name: string
  price: number
  quantity: number
  subtotal: number
}

export default function POSDashboard() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productError, setProductError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const session = getAuthSession()

    if (!session?.token) {
      setProductError('Please sign in again to load products.')
      setIsLoadingProducts(false)
      return
    }

    setIsLoadingProducts(true)
    setProductError(null)

    try {
      const response = await apiFetch('/api/products', {
        headers: apiHeaders(session.token),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load products')
      }

      const nextProducts = Array.isArray(payload.data) ? payload.data.map(mapProduct) : []
      setProducts(nextProducts)
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'Failed to load products')
      setProducts([])
    } finally {
      setIsLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    const refreshProducts = () => {
      if (document.visibilityState === 'visible') {
        void loadProducts()
      }
    }

    window.addEventListener('focus', refreshProducts)
    document.addEventListener('visibilitychange', refreshProducts)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadProducts()
      }
    }, 15000)

    return () => {
      window.removeEventListener('focus', refreshProducts)
      document.removeEventListener('visibilitychange', refreshProducts)
      window.clearInterval(intervalId)
    }
  }, [loadProducts])

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(product => product.category)))], [products])

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const addToCart = useCallback((product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id)
      if (existingItem) {
        toast.success(`${product.name} qty updated`)
        return prevCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        )
      }
      toast.success(`${product.name} added`)
      return [
        ...prevCart,
        { id: product.id, code: product.code, name: product.name, price: product.price, quantity: 1, subtotal: product.price },
      ]
    })
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId))
    toast.info('Item removed')
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity, subtotal: quantity * item.price } : item
      )
    )
  }, [removeFromCart])

  const handleCheckout = useCallback(async (payload: CheckoutPayload) => {
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
      throw new Error(body?.message || body?.error || 'Checkout failed')
    }

    setCart([])
    void loadProducts()

    return body.data as ReceiptTransaction
  }, [loadProducts])

  const handleClearCart = useCallback(() => {
    setCart([])
  }, [])

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] w-full max-w-none overflow-hidden lg:min-h-full lg:overflow-visible">
      <div className="flex h-full min-h-0 w-full max-w-none flex-col gap-4 p-4 sm:gap-6 sm:p-6 lg:grid lg:p-8 xl:grid-cols-[minmax(0,1.25fr)_20rem] 2xl:grid-cols-[minmax(0,1.35fr)_24rem]">
        {/* Products Section */}
        <motion.section
          className={`flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-3xl border border-border/50 bg-background/80 p-4 shadow-sm backdrop-blur-sm sm:p-5 lg:p-6 ${mobileCartExpanded ? 'pb-[33rem] sm:pb-[35rem]' : 'pb-[18.5rem] sm:pb-[19.5rem]'} lg:pb-6`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between flex-shrink-0">
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">Kurtland POS</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Menu</h1>
              <p className="text-sm text-muted-foreground">Search, filter, and add items to the current order.</p>
            </div>
            <div className="flex items-center gap-3 self-start xl:self-auto">
              <span className="text-sm text-muted-foreground tabular-nums">
                {isLoadingProducts ? 'Loading…' : `${filteredProducts.length} items`}
              </span>
              <Button
                onClick={() => setShowProductSelector(true)}
                className="lg:hidden gap-2 h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all"
              >
                <ShoppingBag className="h-4 w-4" />
                Browse Cart Menu
              </Button>
            </div>
          </div>

          {productError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {productError}
            </div>
          )}

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

          <div className="flex gap-2 flex-wrap flex-shrink-0">
            {categories.map((cat) => (
              <motion.button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                whileTap={{ scale: 0.96 }}
                className={
                  `px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 border
                  ${activeCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20'
                    : 'bg-muted/60 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                {cat}
              </motion.button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 -mr-1 lg:pr-2">
            <POSProductGrid products={filteredProducts} onAddToCart={addToCart} />
          </div>
        </motion.section>

        {/* Cart Section */}
        <motion.aside
          className="hidden min-h-0 min-w-0 flex-col gap-3 lg:flex xl:sticky xl:top-0 xl:self-start xl:max-h-[calc(100vh-8rem)] 2xl:gap-4"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="lg:hidden flex items-center justify-between flex-shrink-0 rounded-2xl border border-border/50 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm">
            <div>
              <p className="text-xs font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-0.5">Kurtland POS</p>
              <h2 className="text-xl font-bold tracking-tight">Order</h2>
            </div>
            <Button
              onClick={() => setShowProductSelector(true)}
              className="gap-2 h-10 rounded-xl bg-primary hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all"
            >
              <ShoppingBag className="h-4 w-4" />
              Browse
            </Button>
          </div>

          <POSCart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
          />
        </motion.aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden">
        <div className={`overflow-hidden rounded-t-3xl border border-border/50 bg-card/95 shadow-2xl shadow-black/10 backdrop-blur-md transition-[height] duration-300 ${mobileCartExpanded ? 'h-[70vh]' : 'h-[42vh]'}`}>
          <div className="flex items-center justify-center border-b border-border/50 py-1.5">
            <button
              type="button"
              onClick={() => setMobileCartExpanded((value) => !value)}
              className="h-1.5 w-12 rounded-full bg-muted-foreground/30"
              aria-label={mobileCartExpanded ? 'Collapse cart' : 'Expand cart'}
            />
          </div>
          <POSCart
            items={cart}
            onRemoveItem={removeFromCart}
            onUpdateQuantity={updateQuantity}
            onCheckout={handleCheckout}
            onClearCart={handleClearCart}
            compact
          />
        </div>
      </div>

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