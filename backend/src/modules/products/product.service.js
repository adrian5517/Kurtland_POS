const { HttpError } = require('../../utils/http-error')
const { createProductSchema, updateProductSchema } = require('./product.schema')
const { productRepository } = require('./product.repository')

const productService = {
  async listProducts() {
    return productRepository.findAll()
  },

  async createProduct(input) {
    const parsed = createProductSchema.safeParse(input)

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid product payload')
    }

    return productRepository.create(parsed.data)
  },

  async updateProduct(id, input) {
    const parsed = updateProductSchema.safeParse(input)

    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid product payload')
    }

    const product = await productRepository.update(id, parsed.data)

    if (!product) {
      throw new HttpError(404, 'Product not found')
    }

    return product
  },

  async deleteProduct(id) {
    const deleted = await productRepository.delete(id)

    if (!deleted) {
      throw new HttpError(404, 'Product not found')
    }

    return deleted
  },
}

module.exports = { productService }