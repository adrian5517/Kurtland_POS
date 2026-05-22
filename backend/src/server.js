const { app } = require('./app')
const { env } = require('./config/env')
const { bootstrapDatabase } = require('./db/bootstrap')

async function start() {
  await bootstrapDatabase()

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`)
  })
}

start().catch((error) => {
  console.error(error)
  process.exit(1)
})