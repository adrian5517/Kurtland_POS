const { bootstrapDatabase } = require('../src/db/bootstrap')
const { productRepository } = require('../src/modules/products/product.repository')

async function main() {
  await bootstrapDatabase()

  console.log('Creating Test Biscuit A')
  const a = await productRepository.create({ name: 'Scripted Biscuit A', category: 'Biscuits', price: 30, quantity: 5 })
  console.log('Created:', a)

  console.log('Creating Test Biscuit B')
  const b = await productRepository.create({ name: 'Scripted Biscuit B', category: 'Biscuits', price: 35, quantity: 8 })
  console.log('Created:', b)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
