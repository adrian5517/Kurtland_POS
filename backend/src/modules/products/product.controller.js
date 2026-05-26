const { productService } = require('./product.service')

const productController = {
  async index(_req, res, next) {
    try {
      const products = await productService.listProducts()
      return res.json({ data: products })
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