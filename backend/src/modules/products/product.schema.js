const { z } = require('zod')

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name cannot be empty'),
  sku: z.string().min(1, 'SKU is a required string parameter').optional(),
  category: z.string().min(1, 'Category is required'),
  price: z.number().nonnegative('Base price must be a non-negative number'),
  // srp_price column in DB: the customer-facing retail price.
  // Accepted as either camelCase (from normalizer) or snake_case (raw body).
  srpPrice: z.number().nonnegative('SRP price must be a non-negative number').optional(),
  minStock: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  imageUrl: z.string().url('imageUrl must be a valid URL').nullable().optional(),
  imagePublicId: z.string().min(1).nullable().optional(),
  // is_active column in DB. Accepted as camelCase after normalization.
  isActive: z.boolean().optional(),
})

/**
 * Update schema.
 *
 * Rules:
 *  - Every field is optional (partial update / PATCH-style PUT).
 *  - We do NOT use .strip() (the Zod default) because that silently drops
 *    any key the schema does not declare — which caused is_active and
 *    srp_price to vanish from parsed.data even though normalizeProductPayload
 *    had correctly aliased them to isActive / srpPrice.
 *  - .passthrough() preserves any extra keys rather than dropping them, so
 *    the repository's pushField() can safely skip undefined values without
 *    accidentally skipping values that were present but not declared.
 *
 * NOTE: sku is intentionally excluded from the update schema — SKUs are
 * immutable after creation and must not be changed via the update endpoint.
 */
const updateProductSchema = createProductSchema
  .omit({ sku: true })
  .extend({
    // is_deleted column in DB. Update-only field for soft delete/restore flows.
    isDeleted: z.boolean().optional(),
  })
  .partial()
  .passthrough()

module.exports = { createProductSchema, updateProductSchema }