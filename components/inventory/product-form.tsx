'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { X, Upload, Camera, Search, Check, Plus, Tag } from 'lucide-react'
import { apiFetch, apiHeaders } from '@/lib/api'
import { getAuthSession } from '@/lib/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  /** Pass the deduplicated list of categories from existing products */
  categories?: string[]
  isAdmin?: boolean
}

// ─── Built-in fallback categories (merged with live DB categories) ─────────────



// ─── CategoryCombobox ─────────────────────────────────────────────────────────
//
// A fully accessible, searchable combobox that:
//   • Shows all existing categories (from DB + defaults, deduplicated)
//   • Lets admin type to filter
//   • If the typed text doesn't match any existing category, shows a
//     "Create '[text]'" option at the top — instant, no hidden input toggle
//   • Once a new category is created it's surfaced as a "new" badge item
//   • Non-admins can only pick from the existing list

interface CategoryComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  isAdmin: boolean
  /** Called when admin creates a brand-new category so parent can persist it */
  onNewCategory?: (cat: string) => void
}

function CategoryCombobox({
  value,
  onChange,
  options,
  isAdmin,
  onNewCategory,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const trimmedQuery = query.trim()

  const filtered = useMemo(() => {
    if (!trimmedQuery) return options
    return options.filter(opt =>
      opt.toLowerCase().includes(trimmedQuery.toLowerCase())
    )
  }, [options, trimmedQuery])

  // Show "Create" option only if admin AND the query doesn't exactly match any existing option
  const showCreate =
    isAdmin &&
    trimmedQuery.length > 0 &&
    !options.some(opt => opt.toLowerCase() === trimmedQuery.toLowerCase())

  const handleSelect = useCallback(
    (cat: string, isNew = false) => {
      onChange(cat)
      if (isNew && onNewCategory) onNewCategory(cat)
      setOpen(false)
      setQuery('')
    },
    [onChange, onNewCategory]
  )

  const handleOpen = () => {
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Keyboard: Escape closes, Enter picks first result or creates
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showCreate) {
        handleSelect(trimmedQuery, true)
      } else if (filtered.length > 0) {
        handleSelect(filtered[0])
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors
          bg-background hover:bg-muted/40
          ${open ? 'border-primary ring-1 ring-primary/30' : 'border-primary/20'}
          ${!value ? 'text-muted-foreground' : 'text-foreground'}
        `}
      >
        <span className="flex items-center gap-2 truncate">
          <Tag className="h-3.5 w-3.5 shrink-0 text-primary/50" />
          {value || 'Select or type a category…'}
        </span>
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-primary/20 bg-popover shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/10">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAdmin ? 'Search or type new category…' : 'Search category…'}
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <ul ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {/* Create new option — appears at top when query doesn't match */}
            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={() => handleSelect(trimmedQuery, true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors font-medium"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Create <span className="font-bold">"{trimmedQuery}"</span>
                  </span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    New
                  </span>
                </button>
              </li>
            )}

            {/* Existing categories */}
            {filtered.length > 0 ? (
              filtered.map(cat => (
                <li key={cat}>
                  <button
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors
                      ${value === cat
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted/60 text-foreground'
                      }
                    `}
                  >
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 transition-opacity ${value === cat ? 'opacity-100 text-primary' : 'opacity-0'}`}
                    />
                    {cat}
                  </button>
                </li>
              ))
            ) : !showCreate ? (
              <li className="px-3 py-4 text-sm text-muted-foreground text-center">
                {isAdmin
                  ? 'No match — keep typing to create a new category'
                  : 'No categories found'}
              </li>
            ) : null}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── ProductForm ──────────────────────────────────────────────────────────────

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

  // Session-local custom categories: any category the admin creates in this
  // session is immediately added here so subsequent opens of this form already
  // show the new category without a full page reload.
  const [sessionCategories, setSessionCategories] = useState<string[]>([])

  // Final deduplicated list: live DB categories + defaults + session-created ones
  const mergedCategories = useMemo(() => {
    const combined = [...categories, ...sessionCategories]
    return combined.filter(
      (value, index, self) =>
        self.findIndex(t => t.toLowerCase() === value.toLowerCase()) === index
    )
  }, [categories, sessionCategories])

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
      reader.onload = event => {
        setPreviewUrl(event.target?.result as string)
      }
      reader.readAsDataURL(file)
      setSelectedFile(file)
      setImageRemoved(false)
    }
  }

  // When admin creates a new category, add it to the session list immediately
  const handleNewCategory = useCallback((cat: string) => {
    setSessionCategories(prev =>
      prev.some(c => c.toLowerCase() === cat.toLowerCase()) ? prev : [...prev, cat]
    )
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const minPriceNum = parseFloat(formData.minPrice)
    const maxPriceNum = formData.maxPrice ? parseFloat(formData.maxPrice) : minPriceNum
    const stockNum = parseInt(formData.stock, 10)
    const minStockNum = parseInt(formData.minStock, 10)
    const finalCategory = formData.category

    if (!formData.name || !finalCategory || isNaN(minPriceNum) || minPriceNum <= 0) {
      toast.error('Please fill in all required fields. Price must be positive.')
      return
    }

    if (minPriceNum > maxPriceNum) {
      toast.error('Base price cannot be greater than SRP reference price.')
      return
    }

    setIsSubmitting(true)

    try {
      const session = getAuthSession()
      let imageUrl: string | null | undefined = undefined
      let imagePublicId: string | null | undefined = undefined

      if (selectedFile) {
        if (!session?.token) throw new Error('Your session has expired. Please log in again.')

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
        category: finalCategory,
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
              {/* ── Left: Image ── */}
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
                      }}
                      className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-1 rounded-full hover:bg-destructive/90 transition-colors shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-44 rounded-lg border-2 border-dashed border-primary/20 hover:border-primary/40 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/30 hover:bg-muted/50 transition-all text-muted-foreground"
                    >
                      <Upload className="h-8 w-8 text-primary/60" />
                      <span className="text-xs font-medium">Upload from device</span>
                    </div>
                    <div
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full py-2.5 rounded-lg border border-primary/20 hover:bg-muted/50 flex items-center justify-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground transition-all"
                    >
                      <Camera className="h-4 w-4 text-primary/60" />
                      Take Live Photo
                    </div>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </div>

              {/* ── Right: Name + Category ── */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Pepperoni Pizza Large"
                    className="border-primary/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Category
                    {isAdmin && (
                      <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                        — type to search or create new
                      </span>
                    )}
                  </Label>
                  <CategoryCombobox
                    value={formData.category}
                    onChange={val => setFormData(prev => ({ ...prev, category: val }))}
                    options={mergedCategories}
                    isAdmin={isAdmin}
                    onNewCategory={handleNewCategory}
                  />
                  {/* Show badge when a newly created category is selected */}
                  {formData.category &&
                    sessionCategories.some(
                      c => c.toLowerCase() === formData.category.toLowerCase()
                    ) && (
                      <p className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                        <Plus className="h-3 w-3" />
                        New category — will be saved with this product
                      </p>
                    )}
                </div>
              </div>
            </div>

            {/* ── Pricing + Stock ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-primary/10 pt-4">
              <div className="space-y-2">
                <Label htmlFor="minPrice" className="text-xs">
                  Base Price (₱)
                </Label>
                <Input
                  id="minPrice"
                  type="number"
                  step="0.01"
                  value={formData.minPrice}
                  onChange={e => setFormData(prev => ({ ...prev, minPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPrice" className="text-xs">
                  SRP Reference (₱)
                </Label>
                <Input
                  id="maxPrice"
                  type="number"
                  step="0.01"
                  value={formData.maxPrice}
                  onChange={e => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="0.00"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock" className="text-xs">
                  Initial Quantity
                </Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={e => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock" className="text-xs">
                  Min Stock Alert
                </Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={e => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                  className="border-primary/20"
                />
              </div>
            </div>

            {/* ── Actions ── */}
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
                {isSubmitting ? 'Saving…' : 'Add Product'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}