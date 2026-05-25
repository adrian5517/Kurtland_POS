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
import { toast } from 'sonner'
import { X, Upload, Camera } from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

interface Product {
  id: string
  code: string
  name: string
  category: string
  minStock: number
  minPrice: number
  maxPrice: number
  currentStock: number
  image: string | null
}

interface ProductEditFormProps {
  product?: Product | null
  onClose: () => void
  onSubmit: (data: any) => Promise<void> | void
}

const CATEGORIES = [
  'Pizza',
  'Burgers',
  'Drinks',
  'Desserts',
  'Salads',
  'Pasta',
  'Appetizers',
  'Main Course',
]

export default function ProductEditForm({
  product,
  onClose,
  onSubmit,
}: ProductEditFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    currentStock: '',
    minStock: '',
  })
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        code: product.code || '',
        category: product.category || '',
        minPrice: product.minPrice?.toString() || '0',
        maxPrice: product.maxPrice?.toString() || '0',
        currentStock: product.currentStock?.toString() || '0',
        minStock: product.minStock?.toString() || '5',
      })
      setPreviewUrl(product.image || null)
      setSelectedFile(null)
      setImageRemoved(false)
    }
  } , [product])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setPreviewUrl(event.target?.result as string)
      }
      reader.readAsDataURL(file)
      setSelectedFile(file)
      setImageRemoved(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const minPriceNum = parseFloat(formData.minPrice)
    const maxPriceNum = formData.maxPrice ? parseFloat(formData.maxPrice) : minPriceNum
    const stockNum = parseInt(formData.currentStock, 10)
    const minStockNum = parseInt(formData.minStock, 10)

    if (!formData.name || !formData.category || isNaN(minPriceNum) || minPriceNum < 0) {
      toast.error('Please fill in all required fields accurately')
      return
    }

    if (minPriceNum > maxPriceNum) {
      toast.error('Min price cannot be greater than max price')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getAuthSession()
      let imageUrl: string | null | undefined = undefined // undefined leaves it unchanged in backend update
      let imagePublicId: string | null | undefined = undefined

      if (selectedFile) {
        if (!session?.token) {
          throw new Error('Your session has expired. Please log in again.')
        }

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
        category: formData.category,
        minPrice: minPriceNum,
        maxPrice: maxPriceNum,
        currentStock: stockNum,
        minStock: minStockNum,
        imageUrl,
        imagePublicId,
      })

      toast.success('Product updated successfully')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!product) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl border-primary/20 my-8">
        <CardHeader className="flex flex-row justify-between items-center pb-4 border-b">
          <CardTitle className="text-primary text-xl">Edit Product</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Image Handling */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Product Image</Label>
                {previewUrl ? (
                  <div className="relative w-full h-44 rounded-lg overflow-hidden bg-muted border border-primary/20">
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
                ) : (
                  <div className="w-full h-44 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center bg-muted/30">
                    <p className="text-muted-foreground text-sm">No image selected</p>
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

              {/* Product Info Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code" className="text-sm font-semibold text-muted-foreground">
                    Product Code (Immutable)
                  </Label>
                  <Input
                    id="edit-code"
                    value={formData.code}
                    disabled
                    className="bg-muted/50 border-primary/10 select-none opacity-70"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-semibold">
                    Product Name *
                  </Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter product name"
                    className="border-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-sm font-semibold">
                    Category *
                  </Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger id="edit-category" className="border-primary/20">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Pricing Details */}
            <div className="bg-muted/40 p-4 rounded-lg space-y-3 border border-primary/10">
              <Label className="font-semibold block">Pricing</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-minPrice" className="text-xs">
                    Min Price (₱) *
                  </Label>
                  <Input
                    id="edit-minPrice"
                    type="number"
                    step="0.01"
                    value={formData.minPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                    className="border-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxPrice" className="text-xs">
                    Max Price (₱)
                  </Label>
                  <Input
                    id="edit-maxPrice"
                    type="number"
                    step="0.01"
                    value={formData.maxPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                    className="border-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Inventory Management Updates */}
            <div className="bg-muted/40 p-4 rounded-lg space-y-3 border border-primary/10">
              <Label className="font-semibold block">Stock Management</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-stock" className="text-xs">
                    Current Stock *
                  </Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={formData.currentStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, currentStock: e.target.value }))}
                    className="border-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-minStock" className="text-xs">
                    Min Stock Alert
                  </Label>
                  <Input
                    id="edit-minStock"
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                    className="border-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-primary/10">
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
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
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