const { z } = require('zod')

const createProductSchema = z.object({
  name: z.string().min(1, "Product name cannot be empty"),
  sku: z.string().min(1, "SKU is a required string parameter").optional(),
  category: z.string().min(1, "Category is required"),
  price: z.number().positive("Base price must be a positive number"),
  srpPrice: z.number().nonnegative().optional(),
  minStock: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().min(1).nullable().optional(),
})

const updateProductSchema = createProductSchema.partial().extend({
  sku: z.string().min(1).optional(),
})

module.exports = { createProductSchema, updateProductSchema }