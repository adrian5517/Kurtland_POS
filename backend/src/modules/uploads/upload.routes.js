const { Router } = require('express')
const multer = require('multer')

const { requireAuth } = require('../../middleware/auth')
const { uploadController } = require('./upload.controller')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const uploadRouter = Router()

uploadRouter.use(requireAuth)
uploadRouter.post('/image', upload.single('image'), uploadController.image)

module.exports = { uploadRouter }