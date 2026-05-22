const { cloudinary } = require('../../config/cloudinary')

async function uploadImage(buffer, originalName) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'kurtland/products',
        resource_type: 'image',
        public_id: originalName.replace(/\.[^.]+$/, ''),
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