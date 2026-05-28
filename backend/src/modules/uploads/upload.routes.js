const { Router } = require('express')

const { requireAuth } = require('../../middleware/auth')
const { createImageUpload } = require('../../middleware/file-upload')
const { uploadController } = require('./upload.controller')

// Create multer instance with validation
const imageUpload = createImageUpload()

const uploadRouter = Router()

uploadRouter.use(requireAuth)
uploadRouter.post('/image', imageUpload.single('image'), uploadController.image)

module.exports = { uploadRouter }