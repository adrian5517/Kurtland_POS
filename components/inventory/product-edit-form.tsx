'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { X, Upload, Camera } from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

interface Product {
  id: string
  code: string
  name: string
  category: string
  minPrice: number
  maxPrice: number
  currentStock: number
  image: string | null
}

interface ProductEditFormProps {
  product: Product | null
  onClose: () => void
  onSubmit: (data: any) => Promise<void> | void
  categories?: string[]
  isAdmin?: boolean
}

export default function ProductEditForm({
  product,
  onClose,
  onSubmit,
  categories = [
    'Pizza',
    'Burgers',
    'Drinks',
    'Desserts',
    'Salads',
    'Pasta',
    'Appetizers',
    'Main Course',
  ],
  isAdmin = false,
}: ProductEditFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: product?.name || '',
    category: product?.category || '',
    minPrice: product?.minPrice || 0,
    maxPrice: product?.maxPrice || 0,
    minStock: (product as any)?.minStock || 5,
  })
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.image || null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    setFormData({
      name: product?.name || '',
      category: product?.category || '',
      minPrice: product?.minPrice || 0,
      maxPrice: product?.maxPrice || 0,
      minStock: (product as any)?.minStock || 5,
    })
    setPreviewUrl(product?.image || null)
    setSelectedFile(null)
    setImageRemoved(false)
  }, [product])

  

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setPreviewUrl(result)
      }
      reader.readAsDataURL(file)
      setSelectedFile(file)
        setImageRemoved(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const categoryToUse = showNewCategoryInput ? newCategory.trim() : formData.category
    const minStockNum = Number(formData.minStock)

    if (!formData.name || !categoryToUse || formData.minPrice <= 0) {
      alert('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getAuthSession()
      let imageUrl: string | null | undefined
      let imagePublicId: string | null | undefined

      if (selectedFile && session?.token) {
        const uploadForm = new FormData()
        uploadForm.append('image', selectedFile)

        const uploadResponse = await apiFetch('/api/uploads/image', {
          method: 'POST',
          headers: apiHeaders(session.token),
          body: uploadForm,
        })

        const uploadPayload = await uploadResponse.json()

        if (!uploadResponse.ok) {
          throw new Error(uploadPayload?.message || uploadPayload?.error || 'Image upload failed')
        }

        imageUrl = uploadPayload.data.secure_url
        imagePublicId = uploadPayload.data.public_id
      } else if (imageRemoved) {
        imageUrl = null
        imagePublicId = null
      }

      await onSubmit({
        name: formData.name,
        category: categoryToUse,
        minPrice: formData.minPrice,
        maxPrice: formData.maxPrice,
        minStock: isNaN(minStockNum) ? 5 : minStockNum,
        imageUrl,
        imagePublicId,
      })

      onClose()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg border-primary/20">
        <CardHeader className="flex flex-row justify-between items-center pb-4 border-b">
          <CardTitle className="text-primary">Edit Product</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Image */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Product Image</Label>
              {previewUrl && (
                <div className="relative w-full h-48 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={previewUrl}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null)
                      setSelectedFile(null)
                      setImageRemoved(true)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                      if (cameraInputRef.current) cameraInputRef.current.value = ''
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-primary/20 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Upload Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-primary/20 gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Take Photo
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Product Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter product name"
                className="border-primary/20"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category" className="text-sm font-semibold">
                Category
              </Label>
              <div>
                <Select
                  value={showNewCategoryInput ? '__new__' : formData.category}
                  onValueChange={(value) => {
                    if (value === '__new__') {
                      if (!isAdmin) return
                      setShowNewCategoryInput(true)
                      setFormData(prev => ({ ...prev, category: '' }))
                    } else {
                      setShowNewCategoryInput(false)
                      setFormData(prev => ({ ...prev, category: value }))
                    }
                  }}
                >
                  <SelectTrigger className="border-primary/20">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    {isAdmin && <SelectItem key="__new__" value="__new__">Add new category…</SelectItem>}
                  </SelectContent>
                </Select>
                {showNewCategoryInput && isAdmin && (
                  <div className="pt-2">
                    <Input placeholder="New category name" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="minPrice" className="text-sm font-semibold">
                  Min Price (₱)
                </Label>
                <Input
                  id="minPrice"
                  type="number"
                  value={formData.minPrice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, minPrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice" className="text-sm font-semibold">
                  Max Price (₱)
                </Label>
                <Input
                  id="maxPrice"
                  type="number"
                  value={formData.maxPrice || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock" className="text-sm font-semibold">Min Stock Alert</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStock: parseInt(e.target.value, 10) || 0 }))}
                  placeholder="0"
                  className="border-primary/20"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-primary/20"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
