const dotenv = require('dotenv')

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
}

// Validate required environment variables
const requiredSecrets = ['JWT_SECRET', 'DATABASE_URL']
const missingSecrets = requiredSecrets.filter(secret => !process.env[secret])

if (missingSecrets.length > 0) {
  console.error('❌ FATAL ERROR: Missing required environment variables:')
  missingSecrets.forEach(secret => console.error(`   - ${secret}`))
  console.error('\nPlease set these variables before starting the server.')
  process.exit(1)
}

module.exports = { env }
