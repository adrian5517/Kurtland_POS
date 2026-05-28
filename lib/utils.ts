import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitize and validate image URLs
 * Only allows images from trusted CDN sources
 * Falls back to placeholder if URL is invalid or from untrusted source
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  // Default placeholder image
  const PLACEHOLDER = '/images/placeholder.png'

  if (!url || typeof url !== 'string') {
    return PLACEHOLDER
  }

  try {
    const parsed = new URL(url)
    
    // Whitelist trusted image sources
    const trustedDomains = [
      'cloudinary.com',
      'res.cloudinary.com',
      'cdn.example.com',
      'images.example.com',
      'localhost', // Development
    ]

    const isTrusted = trustedDomains.some(domain =>
      parsed.hostname === domain || parsed.hostname?.endsWith('.' + domain)
    )

    if (!isTrusted) {
      console.warn(`⚠️ Image URL from untrusted domain blocked: ${parsed.hostname}`)
      return PLACEHOLDER
    }

    // Ensure URL uses HTTPS in production
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (parsed.protocol !== 'https:') {
        parsed.protocol = 'https:'
      }
    }

    return parsed.toString()
  } catch {
    console.warn(`⚠️ Invalid image URL: ${url}`)
    return PLACEHOLDER
  }
}

/**
 * Get safe filename from potentially malicious input
 * Removes special characters and path traversal attempts
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '') // Remove leading dots
    .substring(0, 255) // Limit filename length
}
