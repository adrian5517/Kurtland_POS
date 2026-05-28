const { HttpError } = require('../../utils/http-error')
const { createProductSchema, updateProductSchema } = require('./product.schema')
const { productRepository } = require('./product.repository')

// ─── Field parsers ────────────────────────────────────────────────────────────

/**
 * Safely coerce a value to boolean.
 * Handles: true/false literals, "true"/"false" strings (with optional quotes),
 * 1/0 integers (common from query-string serialization).
 * Returns undefined when the value cannot be confidently interpreted.
 */
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (value === 1) return true
    if (value === 0) return false
  }
  if (typeof value === 'string') {
    const clean = value.replace(/['"]/g, '').trim().toLowerCase()
    if (clean === 'true'  || clean === '1') return true
    if (clean === 'false' || clean === '0') return false
  }
  return undefined
}

/**
 * Safely coerce a value to a finite number.
 * Returns undefined when the value is not a valid finite number.
 */
const parseNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const num = Number(value.replace(/['"]+/g, '').trim())
    if (!Number.isNaN(num) && Number.isFinite(num)) return num
  }
  return undefined
}

// ─── Payload normalizer ───────────────────────────────────────────────────────

/**
 * Normalize a raw request body into the camelCase shape that the Zod schema
 * and the repository both expect.
 *
 * Priority rules (highest → lowest):
 *   camelCase key > snake_case key > undefined
 *
 * For boolean / numeric fields we run each value through the safe parsers so
 * that stringified values from query strings ("true", "0.00") are handled
 * correctly — even when the caller does not set Content-Type: application/json.
 *
 * IMPORTANT: we use explicit `in` checks (rather than `!== undefined`) for
 * presence detection so that an explicit `null` payload (e.g. removing an
 * image) is preserved and not silently dropped.
 */
const normalizeProductPayload = (input) => {
  const normalized = { ...input }

  // ── Boolean fields ──────────────────────────────────────────────────────────
  // Resolve isActive from camelCase first, then snake_case fallback.
  if (!('isActive' in normalized) && 'is_active' in normalized) {
    normalized.isActive = parseBoolean(normalized.is_active)
  } else if ('isActive' in normalized) {
    // Re-parse in case the value arrived as a string through query-string merge
    const parsed = parseBoolean(normalized.isActive)
    if (parsed !== undefined) normalized.isActive = parsed
  }

  // ── Numeric fields ──────────────────────────────────────────────────────────
  if (!('srpPrice' in normalized) && 'srp_price' in normalized) {
    normalized.srpPrice = parseNumber(normalized.srp_price)
  } else if ('srpPrice' in normalized) {
    const parsed = parseNumber(normalized.srpPrice)
    if (parsed !== undefined) normalized.srpPrice = parsed
  }

  if (!('minStock' in normalized) && 'min_stock' in normalized) {
    normalized.minStock = parseNumber(normalized.min_stock)
  } else if ('minStock' in normalized) {
    const parsed = parseNumber(normalized.minStock)
    if (parsed !== undefined) normalized.minStock = parsed
  }

  // Re-parse price as well for consistency
  if ('price' in normalized) {
    const parsed = parseNumber(normalized.price)
    if (parsed !== undefined) normalized.price = parsed
  }

  // ── Image fields — preserve explicit null (= "remove image") ────────────────
  if (!('imageUrl' in normalized) && 'image_url' in normalized) {
    normalized.imageUrl = normalized.image_url
  }
  if (!('imagePublicId' in normalized) && 'image_public_id' in normalized) {
    normalized.imagePublicId = normalized.image_public_id
  }

  return normalized
}

// ─── Service ──────────────────────────────────────────────────────────────────

const productService = {
  async listProducts() {
    return productRepository.findAll()
  },

  async createProduct(input) {
    const normalizedInput = normalizeProductPayload(input)
    const parsed = createProductSchema.safeParse(normalizedInput)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid product payload'
      throw new HttpError(400, message)
    }
    return productRepository.create(parsed.data)
  },

  async updateProduct(id, input) {
    // Normalize raw request body / query-string values into camelCase
    const normalizedInput = normalizeProductPayload(input)

    // Validate with the update schema.
    // updateProductSchema uses .passthrough() so that all normalized keys
    // survive into parsed.data — nothing is silently stripped.
    const parsed = updateProductSchema.safeParse(normalizedInput)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid product payload'
      throw new HttpError(400, message)
    }

    // Confirm at least one meaningful field is being updated.
    // Without this guard a completely empty body would return 200 with no DB write.
    const knownFields = [
      'name', 'category', 'price', 'srpPrice', 'minStock',
      'quantity', 'isActive', 'imageUrl', 'imagePublicId',
    ]
    const hasUpdate = knownFields.some((k) => k in parsed.data && parsed.data[k] !== undefined)
    if (!hasUpdate) {
      throw new HttpError(400, 'No valid fields provided for update')
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

  async getProductsByCashier(cashierId) {
    return await productRepository.findByCashierId(cashierId)
  },

  async getAllCashiers() {
    return await productRepository.getAllCashiers()
  },

  async getCashiersForProduct(productId) {
    return await productRepository.getCashiersForProduct(productId)
  },

  async assignProductToCashiers(productId, cashierIds) {
    // First, remove all existing assignments for this product
    const existingCashiers = await productRepository.getCashiersForProduct(productId)
    for (const cashierId of existingCashiers) {
      await productRepository.removeFromCashier(productId, cashierId)
    }

    // Then, assign to the new set of cashiers
    const assignments = []
    for (const cashierId of cashierIds) {
      const result = await productRepository.assignToCashier(productId, cashierId)
      if (result) assignments.push(result)
    }

    return {
      productId,
      assignedToCashiers: cashierIds.length,
      assignments,
    }
  },

  async getCashierAnalytics() {
    return await productRepository.getCashierAnalytics()
  },
}

module.exports = { productService }