const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')

const { apiRouter } = require('./routes')
const { errorHandler, notFoundHandler } = require('./middleware/error-handler')

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.use('/api', apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = { app }