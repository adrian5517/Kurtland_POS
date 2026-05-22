const { z } = require('zod')

const createProductSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  category: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().min(1).nullable().optional(),
})

const updateProductSchema = createProductSchema.partial().extend({
  sku: z.string().min(1).optional(),
})

module.exports = { createProductSchema, updateProductSchema }