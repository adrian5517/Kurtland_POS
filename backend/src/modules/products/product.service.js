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

  if (!('isDeleted' in normalized) && 'is_deleted' in normalized) {
    normalized.isDeleted = parseBoolean(normalized.is_deleted)
  } else if ('isDeleted' in normalized) {
    const parsed = parseBoolean(normalized.isDeleted)
    if (parsed !== undefined) normalized.isDeleted = parsed
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
      'quantity', 'isActive', 'isDeleted', 'imageUrl', 'imagePublicId',
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

  async removeSingleCashier(productId, cashierId) {
    const removed = await productRepository.removeFromCashier(productId, cashierId)
    if (!removed) {
      throw new HttpError(404, 'Assignment not found')
    }
    return removed
  },

  async assignProductToCashiers(productId, cashierIds) {
    // Delta update so existing cashiers keep their distributed_quantity:
    // remove ONLY those no longer selected, add ONLY the newly selected.
    // (The old "remove all then re-add" wiped every cashier's allocation to 0.)
    const existingRows = await productRepository.getCashiersForProduct(productId)
    const existingIds = new Set(existingRows.map((r) => r.cashier_id))
    const targetIds = new Set(cashierIds)

    for (const row of existingRows) {
      if (!targetIds.has(row.cashier_id)) {
        await productRepository.removeFromCashier(productId, row.cashier_id)
      }
    }

    const assignments = []
    for (const cashierId of cashierIds) {
      if (!existingIds.has(cashierId)) {
        const result = await productRepository.assignToCashier(productId, cashierId)
        if (result) assignments.push(result)
      }
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

  async distributeProducts(productId, distributions) {
    if (!Array.isArray(distributions) || distributions.length === 0) {
      throw new HttpError(400, 'distributions must be a non-empty array')
    }
    for (const d of distributions) {
      const cashierId = Number(d.cashierId)
      const quantity = Number(d.quantity)
      if (!Number.isInteger(cashierId) || cashierId <= 0) {
        throw new HttpError(400, `Invalid cashier ID: ${d.cashierId}`)
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new HttpError(400, `Quantity must be a non-negative integer for cashier ${cashierId}`)
      }
    }
    const normalised = distributions.map(d => ({ cashierId: Number(d.cashierId), quantity: Number(d.quantity) }))
    return productRepository.distributeWithQuantity(productId, normalised)
  },
}

module.exports = { productService }