const { productService } = require('./product.service')

const productController = {
  async index(_req, res, next) {
    try {
      const products = await productService.listProducts()
      const enrichedProducts = products.map((product) => {
        const sellingPrice = Number(product.srp_price ?? product.srpPrice ?? 0)
        const costPrice = Number(product.price ?? 0)
        const profit = sellingPrice - costPrice
        const profitMargin = sellingPrice > 0
          ? Number(((profit / sellingPrice) * 100).toFixed(2))
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
}

module.exports = { productController }