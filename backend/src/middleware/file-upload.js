/**
 * File Upload Validation Middleware
 * 
 * Validates uploaded files for:
 * - Size limits (max 5MB for images)
 * - MIME type restrictions
 * - Filename sanitization
 */

const multer = require('multer')

// Allowed MIME types for image uploads
const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * Create configured multer instance with validation
 */
const createImageUpload = () => {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
    fileFilter: (req, file, cb) => {
      // Check MIME type
      if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: JPEG, PNG, WebP`), false)
      }

      // Sanitize filename (remove special characters, prevent directory traversal)
      const sanitizedName = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 100)
      
      file.originalname = sanitizedName
      cb(null, true)
    },
  })
}

module.exports = { createImageUpload, MAX_FILE_SIZE, ALLOWED_MIME_TYPES }
