const { productService } = require('./product.service')

const productController = {
  async index(_req, res, next) {
    try {
      const userId = _req.user?.id
      const userRole = _req.user?.role

      // Fetch products based on user role
      let products = await productService.listProducts()

      // If user is a cashier, filter to only assigned products
      if (userRole === 'cashier' && userId) {
        const assignedProducts = await productService.getProductsByCashier(userId)
        products = products.filter(p => assignedProducts.some(ap => ap.id === p.id))
      }

      const enrichedProducts = products.map((product) => {
        const sellingPrice = Number(product.srp_price ?? product.srpPrice ?? 0)
        const costPrice = Number(product.price ?? 0)
        const profit = sellingPrice - costPrice
        const profitMargin = costPrice > 0
          ? Number(((profit / costPrice) * 100).toFixed(2))
          : 0

        return {
          ...product,
          profit,
          profit_margin: profitMargin,
        }
      })
      return res.json({ data: enrichedProducts })
    } catch (error) {
      next(error)
    }
  },

  async store(req, res, next) {
    try {
      const product = await productService.createProduct(req.body)
      return res.status(201).json({ data: product })
    } catch (error) {
      next(error)
    }
  },

  async update(req, res, next) {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }

      // Body takes precedence over query string.
      // We intentionally do NOT merge req.query into the payload here:
      // mixing query-string values with JSON body fields is the original
      // source of confusion — the service's normalizer now handles any
      // snake_case / camelCase aliasing from a single source of truth.
      const payload = req.body

      const product = await productService.updateProduct(id, payload)
      return res.json({ data: product })
    } catch (error) {
      next(error)
    }
  },

  async destroy(req, res, next) {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }
      await productService.deleteProduct(id)
      return res.status(204).send()
    } catch (error) {
      next(error)
    }
  },

  async getCashiers(_req, res, next) {
    try {
      console.log('📡 [API] GET /api/products/cashiers/list - Fetching all cashiers')
      const cashiers = await productService.getAllCashiers()
      console.log('📡 [API] Found cashiers:', cashiers)
      return res.json({ data: cashiers })
    } catch (error) {
      console.error('❌ [API] Error fetching cashiers:', error)
      next(error)
    }
  },

  async getCashiersForProduct(req, res, next) {
    try {
      const productId = Number(req.params.id)
      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }
      const cashierIds = await productService.getCashiersForProduct(productId)
      return res.json({ data: cashierIds })
    } catch (error) {
      next(error)
    }
  },

  async assignProductToCashiers(req, res, next) {
    try {
      const productId = Number(req.params.id)
      const { cashierIds } = req.body

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }

      if (!Array.isArray(cashierIds)) {
        return res.status(400).json({ error: 'cashierIds must be an array' })
      }

      const result = await productService.assignProductToCashiers(productId, cashierIds)
      return res.json({ data: result, message: 'Product assigned to cashiers' })
    } catch (error) {
      next(error)
    }
  },

  async getCashierAnalytics(_req, res, next) {
    try {
      console.log('📊 [API] GET /api/products/cashiers/analytics - Fetching cashier analytics')
      const analytics = await productService.getCashierAnalytics()
      console.log('📊 [API] Cashier analytics retrieved:', analytics.length, 'cashiers')
      return res.json({ data: analytics })
    } catch (error) {
      console.error('❌ [API] Error fetching cashier analytics:', error)
      next(error)
    }
  },

  async removeSingleCashier(req, res, next) {
    try {
      const productId = Number(req.params.id)
      const cashierId = Number(req.params.cashierId)
      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Invalid product ID' })
      }
      if (!Number.isInteger(cashierId) || cashierId <= 0) {
        return res.status(400).json({ error: 'Invalid cashier ID' })
      }
      await productService.removeSingleCashier(productId, cashierId)
      return res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { productController }