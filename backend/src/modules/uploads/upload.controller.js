const { uploadService } = require('./upload.service')

const uploadController = {
  async image(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'Image file is required' })
      }

      const uploaded = await uploadService.image(req.file)
      return res.status(201).json({ data: uploaded })
    } catch (error) {
      next(error)
    }
  },
}

module.exports = { uploadController }