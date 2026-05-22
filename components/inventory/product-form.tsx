'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Camera, Upload, X } from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

interface ProductFormProps {
  onClose: () => void
  onSubmit: (product: any) => Promise<void> | void
}

export default function ProductForm({ onClose, onSubmit }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    stock: '',
    minStock: '',
  })

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = (file: File) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setImagePreview(result)
    }
    reader.readAsDataURL(file)
    setSelectedFile(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.code || !formData.minPrice || !formData.stock) {
      toast.error('Please fill all required fields')
      return
    }

    if (parseInt(formData.stock) <= 0) {
      toast.error('Stock must be greater than 0')
      return
    }

    if (parseInt(formData.minPrice) > parseInt(formData.maxPrice || formData.minPrice)) {
      toast.error('Min price cannot be greater than max price')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getAuthSession()
      let imageUrl: string | null = null
      let imagePublicId: string | null = null

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
      }

      await onSubmit({
        name: formData.name,
        code: formData.code,
        category: formData.category,
        minPrice: parseInt(formData.minPrice),
        maxPrice: parseInt(formData.maxPrice || formData.minPrice),
        stock: parseInt(formData.stock),
        minStock: parseInt(formData.minStock || '5'),
        imageUrl,
        imagePublicId,
      })

      toast.success('Product added successfully')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save product')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-2xl border-primary/20 my-8">
        <CardHeader className="flex flex-row justify-between items-start pb-4">
          <div>
            <CardTitle className="text-primary">Add New Product</CardTitle>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload Section */}
            <div className="space-y-3">
              <Label className="text-foreground font-semibold">Product Image</Label>
              <div className="space-y-3">
                {imagePreview ? (
                  <div className="relative w-full h-40 bg-muted rounded-lg overflow-hidden border-2 border-primary/20">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null)
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                        if (cameraInputRef.current) cameraInputRef.current.value = ''
                      }}
                      className="absolute top-2 right-2 p-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-40 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center bg-muted/30">
                    <p className="text-muted-foreground text-sm">No image selected</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex-1 gap-2 border-primary/20"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                  <Button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    variant="outline"
                    className="flex-1 gap-2 border-primary/20"
                  >
                    <Camera className="h-4 w-4" />
                    Camera
                  </Button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
              </div>
            </div>

            {/* Product Details Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground text-sm font-semibold">Product Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Pepperoni Pizza"
                  className="border-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-sm font-semibold">Product Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g., PIZ001"
                  className="border-primary/20"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground text-sm font-semibold">Category</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Pizza"
                  className="border-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="bg-muted/40 p-4 rounded-lg space-y-3">
            <Label className="text-foreground font-semibold">Pricing *</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground text-sm">Min Price (₱) *</Label>
                <Input
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-sm">Max Price (₱)</Label>
                <Input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  className="border-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Stock Section */}
          <div className="bg-muted/40 p-4 rounded-lg space-y-3">
            <Label className="text-foreground font-semibold">Stock Management *</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground text-sm">Current Stock *</Label>
                <Input
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                  placeholder="0"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground text-sm">Min Stock Alert</Label>
                <Input
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                  placeholder="5"
                  className="border-primary/20"
                />
                <p className="text-xs text-muted-foreground">Warning when below this</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-primary/10">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-primary/20"
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isSubmitting ? 'Saving...' : 'Add Product'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
