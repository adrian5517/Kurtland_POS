const { z } = require('zod')

const orderItemSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  subtotal: z.number().nonnegative(),
})

const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  totalAmount: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
})

module.exports = { createOrderSchema }