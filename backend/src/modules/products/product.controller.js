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
      const product = await productService.updateProduct(Number(req.params.id), req.body)
      return res.json({ data: product })
    } catch (error) {
      next(error)
    }
  },

  async destroy(req, res, next) {
    try {
      await productService.deleteProduct(Number(req.params.id))
      return res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { productController }