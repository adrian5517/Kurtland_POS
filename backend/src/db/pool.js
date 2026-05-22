const { Pool } = require('pg')
const { env } = require('../config/env')

const db = new Pool({
  connectionString: env.databaseUrl,
})

module.exports = { db }