const { cloudinary } = require('../../config/cloudinary')

async function uploadImage(buffer, originalName) {
  // Build a unique, sanitized public_id so two uploads with the same filename
  // (e.g. "photo.jpg") don't overwrite each other in Cloudinary.
  const baseName = String(originalName || 'image')
    .replace(/\.[^.]+$/, '')          // strip extension
    .replace(/[^a-zA-Z0-9_-]/g, '_')  // sanitize to safe chars
    .slice(0, 60) || 'image'
  const uniquePublicId = `${baseName}_${Date.now()}`

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kurtland/products',
        resource_type: 'image',
        public_id: uniquePublicId,
      },
      (error, result) => {
        if (error) {
          reject(error)
          return
        }

        resolve(result)
      },
    )

    stream.end(buffer)
  })
}

const uploadService = {
  async image(file) {
    const result = await uploadImage(file.buffer, file.originalname)

    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    }
  },
}

module.exports = { uploadService }