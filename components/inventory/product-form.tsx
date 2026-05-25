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
  minPrice: number
  maxPrice: number
  currentStock: number
  image: string | null
}

interface ProductFormProps {
  product?: Product | null
  onClose: () => void
  onSubmit: (data: any) => Promise<void> | void
  categories?: string[]
  isAdmin?: boolean
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

export default function ProductForm({
  product,
  onClose,
  onSubmit,
  categories = [],
  isAdmin = false,
}: ProductFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    stock: '',
    minStock: '',
  })
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        category: product.category || '',
        minPrice: product.minPrice?.toString() || '0',
        maxPrice: product.maxPrice?.toString() || '0',
        stock: product.currentStock?.toString() || '0',
        minStock: (product as any).minStock?.toString() || '5',
      })
      setPreviewUrl(product.image || null)
      setSelectedFile(null)
      setImageRemoved(false)
    }
  }, [product])

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
    const stockNum = parseInt(formData.stock, 10)
    const minStockNum = parseInt(formData.minStock, 10)

    const categoryToUse = showNewCategoryInput ? newCategory.trim() : formData.category
    if (!formData.name || !categoryToUse || isNaN(minPriceNum) || minPriceNum <= 0) {
      toast.error('Please fill in all required fields accurately. Price must be positive.')
      return
    }

    if (minPriceNum > maxPriceNum) {
      toast.error('Min price cannot be greater than max price')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getAuthSession()
      let imageUrl: string | null | undefined = undefined
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
        category: categoryToUse,
        minPrice: minPriceNum,
        maxPrice: maxPriceNum,
        stock: isNaN(stockNum) ? 0 : stockNum,
        minStock: isNaN(minStockNum) ? 5 : minStockNum,
        imageUrl,
        imagePublicId,
      })

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
        <CardHeader className="flex flex-row justify-between items-center pb-4 border-b">
          <CardTitle className="text-primary text-xl">Add New Product</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Product Image</Label>
                {previewUrl ? (
                  <div className="relative w-full h-44 rounded-lg overflow-hidden bg-muted border border-primary/20">
                    <img src={previewUrl} alt="Product preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setPreviewUrl(null); setSelectedFile(null); setImageRemoved(true); }} className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/90 transition-colors shadow-sm">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div onClick={() => fileInputRef.current?.click()} className="w-full h-44 rounded-lg border-2 border-dashed border-primary/20 hover:border-primary/40 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-all text-muted-foreground">
                      <Upload className="h-8 w-8 text-primary/60" />
                      <span className="text-xs font-medium">Upload via local storage</span>
                    </div>
                    <div onClick={() => cameraInputRef.current?.click()} className="w-full py-2.5 rounded-lg border border-primary/20 hover:bg-muted/50 flex items-center justify-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground transition-all">
                      <Camera className="h-4 w-4 text-primary/60" />
                      Take Live Photo
                    </div>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageChange} className="hidden" />
                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Pepperoni Pizza Large"
                    className="border-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <div>
                    <Select
                      value={showNewCategoryInput ? '__new__' : formData.category}
                      onValueChange={(value) => {
                        if (value === '__new__') {
                          if (!isAdmin) {
                            // non-admin safety: ignore
                            return
                          }
                          setShowNewCategoryInput(true)
                          setFormData(prev => ({ ...prev, category: '' }))
                        } else {
                          setShowNewCategoryInput(false)
                          setFormData(prev => ({ ...prev, category: value }))
                        }
                      }}
                    >
                      <SelectTrigger className="border-primary/20">
                        <SelectValue placeholder="Select inventory category" />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories && categories.length > 0 ? categories : CATEGORIES).map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        {isAdmin && (
                          <SelectItem key="__new__" value="__new__">Add new category…</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {showNewCategoryInput && isAdmin && (
                      <div className="pt-2">
                        <Input
                          placeholder="New category name"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-primary/10 pt-4">
              <div className="space-y-2">
                <Label htmlFor="minPrice" className="text-xs">Base Price (₱)</Label>
                <Input
                  id="minPrice"
                  type="number"
                  step="0.01"
                  value={formData.minPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock" className="text-xs">Min Stock Alert</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice" className="text-xs">SRP Reference (₱)</Label>
                <Input
                  id="maxPrice"
                  type="number"
                  step="0.01"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock" className="text-xs">Initial Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                  className="border-primary/20"
                />
              </div>
            </div>
            

            <div className="flex gap-3 pt-4 border-t border-primary/10">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-primary/20" >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" >
                {isSubmitting ? 'Saving...' : 'Add Product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}