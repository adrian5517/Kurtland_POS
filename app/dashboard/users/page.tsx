'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Search,
  Shield,
  ShieldOff,
  KeyRound,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
  Users,
  UserCheck,
  UserX,
  Crown,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react'
import { getAuthSession } from '@/lib/auth'
import { apiUrl, apiHeaders } from '@/lib/api'

// Types
type UserRole = 'admin' | 'cashier'
type RoleFilter = 'all' | UserRole
type StatusFilter = 'all' | 'active' | 'inactive'

interface User {
  id: number
  email: string
  name: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
}

// Constants
const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'cashier', label: 'Cashier' },
]
const MIN_PASSWORD_LEN = 8

// Helpers
function getInitials(name: string | null, email: string) {
  if (name && name.trim()) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  }
  return email[0].toUpperCase()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function validateEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

async function apiRequest<T>(path: string, method: string, token: string, body?: object): Promise<T> {
  const headers = apiHeaders(token)
  if (body) headers.set('Content-Type', 'application/json')
  const res = await fetch(apiUrl(path), { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`)
  return json.data ?? json
}

// UserAvatar
function UserAvatar({ user }: { user: User }) {
  const initials = getInitials(user.name, user.email)
  const isAdmin = user.role === 'admin'
  return (
    <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black border shrink-0 ${
      isAdmin ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-amber-500/15 border-amber-500/30 text-amber-700'
    }`}>
      {initials}
    </div>
  )
}

// RoleBadge
function RoleBadge({ role }: { role: UserRole }) {
  return role === 'admin' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
      <Crown className="h-2.5 w-2.5" />Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
      <Shield className="h-2.5 w-2.5" />Cashier
    </span>
  )
}

// StatusBadge
function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-green-500/10 text-green-700 border border-green-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 inline-block" />Inactive
    </span>
  )
}

// PasswordInput
function PasswordInput({ value, onChange, placeholder, id }: {
  value: string; onChange: (v: string) => void; placeholder?: string; id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-xl border-primary/20 pr-10" autoComplete="new-password" />
      <button type="button" onClick={() => setShow(p => !p)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

// TableSkeleton
function TableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
          <div className="h-9 w-9 rounded-xl bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted rounded w-32" /><div className="h-3 bg-muted rounded w-48" />
          </div>
          <div className="h-6 w-16 bg-muted rounded-lg" /><div className="h-6 w-14 bg-muted rounded-lg" />
          <div className="h-3 w-24 bg-muted rounded ml-4" />
          <div className="flex gap-2">{Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-8 w-8 bg-muted rounded-xl" />)}</div>
        </div>
      ))}
    </div>
  )
}

// AddUserModal
interface AddUserModalProps { open: boolean; onClose: () => void; onCreated: (user: User) => void; token: string }
function AddUserModal({ open, onClose, onCreated, token }: AddUserModalProps) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'cashier' as UserRole })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function reset() { setForm({ name: '', email: '', password: '', confirmPassword: '', role: 'cashier' }); setErrors({}) }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!validateEmail(form.email)) e.email = 'Invalid email format'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < MIN_PASSWORD_LEN) e.password = `Minimum ${MIN_PASSWORD_LEN} characters`
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match'
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const user = await apiRequest<User>('/api/users', 'POST', token, {
        name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password, role: form.role,
      })
      onCreated(user); toast.success(`User "${form.name.trim()}" created successfully`); reset(); onClose()
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Add New User</DialogTitle>
          <DialogDescription>Create a new team member account.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-name">Full Name</Label>
            <Input id="add-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Maria Santos" className="rounded-xl border-primary/20" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-email">Email</Label>
            <Input id="add-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="maria@example.com" className="rounded-xl border-primary/20" autoComplete="off" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <PasswordInput value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))}
              placeholder={`At least ${MIN_PASSWORD_LEN} characters`} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <PasswordInput value={form.confirmPassword} onChange={v => setForm(p => ({ ...p, confirmPassword: v }))}
              placeholder="Re-enter password" />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="flex gap-2">
              {ROLES.map(r => (
                <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, role: r.value }))}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    form.role === r.value
                      ? r.value === 'admin' ? 'bg-primary text-primary-foreground border-primary' : 'bg-amber-600 text-white border-amber-600'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// EditUserModal
interface EditUserModalProps { user: User | null; selfId: number; open: boolean; onClose: () => void; onUpdated: (u: User) => void; token: string }
function EditUserModal({ user, selfId, open, onClose, onUpdated, token }: EditUserModalProps) {
  const [form, setForm] = useState({ name: '', role: 'cashier' as UserRole })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const isSelf = user?.id === selfId

  useEffect(() => { if (user) setForm({ name: user.name || '', role: user.role }) }, [user])

  async function handleSubmit() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      const updated = await apiRequest<User>(`/api/users/${user!.id}`, 'PUT', token, { name: form.name.trim(), role: form.role })
      onUpdated(updated); toast.success('User updated successfully'); onClose()
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Edit User</DialogTitle>
          <DialogDescription>Update name and role for {user?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="rounded-xl border-primary/20" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            {isSelf ? (
              <p className="text-xs text-muted-foreground bg-muted/40 border rounded-xl px-3 py-2">You cannot change your own role.</p>
            ) : (
              <div className="flex gap-2">
                {ROLES.map(r => (
                  <button key={r.value} type="button" onClick={() => setForm(p => ({ ...p, role: r.value }))}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      form.role === r.value
                        ? r.value === 'admin' ? 'bg-primary text-primary-foreground border-primary' : 'bg-amber-600 text-white border-amber-600'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}>{r.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ResetPasswordModal
interface ResetPasswordModalProps { user: User | null; open: boolean; onClose: () => void; token: string }
function ResetPasswordModal({ user, open, onClose, token }: ResetPasswordModalProps) {
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function reset() { setForm({ password: '', confirmPassword: '' }); setErrors({}) }

  async function handleSubmit() {
    const e: Record<string, string> = {}
    if (form.password.length < MIN_PASSWORD_LEN) e.password = `Minimum ${MIN_PASSWORD_LEN} characters`
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match'
    if (Object.keys(e).length) { setErrors(e); return }
    setLoading(true)
    try {
      await apiRequest(`/api/users/${user!.id}/password`, 'PATCH', token, { password: form.password })
      toast.success(`Password reset for ${user!.name || user!.email}`); reset(); onClose()
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Reset Password</DialogTitle>
          <DialogDescription>Set a new password for <span className="font-semibold text-foreground">{user?.name || user?.email}</span>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <PasswordInput value={form.password} onChange={v => setForm(p => ({ ...p, password: v }))} placeholder={`At least ${MIN_PASSWORD_LEN} characters`} />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <PasswordInput value={form.confirmPassword} onChange={v => setForm(p => ({ ...p, confirmPassword: v }))} placeholder="Re-enter password" />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose() }} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Reset Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// DeleteDialog
interface DeleteDialogProps { user: User | null; open: boolean; onClose: () => void; onDeleted: (id: number) => void; token: string }
function DeleteDialog({ user, open, onClose, onDeleted, token }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await apiRequest(`/api/users/${user!.id}`, 'DELETE', token)
      onDeleted(user!.id); toast.success(`${user!.name || user!.email} has been removed`); onClose()
    } catch (err: any) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-lg font-bold">Delete User</DialogTitle>
          </div>
          <DialogDescription className="text-sm">
            Permanently delete <span className="font-semibold text-foreground">{user?.name || user?.email}</span>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleDelete} disabled={loading}
            className="rounded-xl gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Main Page
export default function UsersPage() {
  const session = getAuthSession()
  const token = session?.token ?? ''
  const selfId = session?.user.id ?? 0

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  const loadUsers = useCallback(async () => {
    if (!token) return
    setIsLoading(true); setError(null)
    try {
      const data = await apiRequest<User[]>('/api/users', 'GET', token)
      setUsers(data)
    } catch (err: any) { setError(err.message) }
    finally { setIsLoading(false) }
  }, [token])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter(u => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.name || '').toLowerCase().includes(q)) return false
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (statusFilter === 'active' && !u.isActive) return false
      if (statusFilter === 'inactive' && u.isActive) return false
      return true
    })
  }, [users, search, roleFilter, statusFilter])

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    admins: users.filter(u => u.role === 'admin').length,
    cashiers: users.filter(u => u.role === 'cashier').length,
  }), [users])

  async function handleToggleStatus(user: User) {
    if (user.id === selfId) { toast.error('You cannot deactivate your own account'); return }
    setTogglingId(user.id)
    try {
      const updated = await apiRequest<User>(`/api/users/${user.id}/status`, 'PATCH', token)
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
      toast.success(`${updated.name || updated.email} is now ${updated.isActive ? 'active' : 'inactive'}`)
    } catch (err: any) { toast.error(err.message) }
    finally { setTogglingId(null) }
  }

  const ROLE_FILTER_TABS: { value: RoleFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: users.length },
    { value: 'admin', label: 'Admins', count: stats.admins },
    { value: 'cashier', label: 'Cashiers', count: stats.cashiers },
  ]

  return (
    <div className="w-full max-w-none animate-in fade-in duration-300">

      {/* Page Header */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b pb-5 mb-6">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage team accounts, roles, and access control.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={isLoading} className="gap-2 rounded-xl h-9 px-4">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-2 rounded-xl h-9 px-4">
            <Plus className="h-4 w-4" />Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Users', value: stats.total, Icon: Users, color: 'text-primary' },
          { label: 'Active', value: stats.active, Icon: UserCheck, color: 'text-green-600' },
          { label: 'Inactive', value: stats.inactive, Icon: UserX, color: 'text-gray-500' },
          { label: 'Admins', value: stats.admins, Icon: Crown, color: 'text-primary' },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl border shadow-sm bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted/60 border flex items-center justify-center shrink-0">
                <s.Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Search by name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 rounded-xl border-primary/20 pl-10 bg-card shadow-sm" />
        </div>
        <div className="flex gap-1.5 bg-muted/60 border p-1 rounded-xl shadow-inner shrink-0">
          {ROLE_FILTER_TABS.map(tab => (
            <button key={tab.value} onClick={() => setRoleFilter(tab.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                roleFilter === tab.value ? 'bg-background text-foreground shadow-sm border' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
              <span className={`text-[10px] font-black rounded px-1 ${
                roleFilter === tab.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 bg-muted/60 border p-1 rounded-xl shadow-inner shrink-0">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize ${
                statusFilter === s ? 'bg-background text-foreground shadow-sm border' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {s === 'all' ? 'All Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-3 mb-5">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button onClick={loadUsers} className="text-xs font-semibold underline shrink-0">Retry</button>
        </div>
      )}

      {/* Users Table */}
      <Card className="w-full overflow-hidden rounded-2xl border shadow-sm bg-card">
        <CardContent className="p-0">
          {isLoading ? <TableSkeleton /> : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Users className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">{users.length === 0 ? 'No users yet.' : 'No users match your filters.'}</p>
              {users.length > 0 && (
                <button onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}
                  className="text-xs text-primary underline underline-offset-2">Clear filters</button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[780px] w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} className={`px-5 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider ${h === 'Actions' ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.map(user => {
                    const isSelf = user.id === selfId
                    const isToggling = togglingId === user.id
                    return (
                      <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                                {user.name || '—'}
                                {isSelf && (
                                  <span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-md">You</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                        <td className="px-5 py-3.5"><StatusBadge isActive={user.isActive} /></td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button variant="ghost" size="icon" onClick={() => setEditTarget(user)}
                              className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary" title="Edit user">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setResetTarget(user)}
                              className="h-8 w-8 rounded-xl hover:bg-amber-500/10 hover:text-amber-700" title="Reset password">
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(user)}
                              disabled={isSelf || isToggling}
                              className={`h-8 w-8 rounded-xl transition-colors ${isSelf ? 'opacity-30 cursor-not-allowed' : user.isActive ? 'hover:bg-orange-500/10 hover:text-orange-600' : 'hover:bg-green-500/10 hover:text-green-700'}`}
                              title={isSelf ? 'Cannot deactivate yourself' : user.isActive ? 'Deactivate' : 'Activate'}>
                              {isToggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : user.isActive ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(user)}
                              disabled={isSelf}
                              className={`h-8 w-8 rounded-xl transition-colors ${isSelf ? 'opacity-30 cursor-not-allowed' : 'hover:bg-destructive/10 hover:text-destructive'}`}
                              title={isSelf ? 'Cannot delete yourself' : 'Delete user'}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
                <span>Showing <span className="font-bold text-foreground">{filteredUsers.length}</span> of <span className="font-bold text-foreground">{users.length}</span> users</span>
                {(search || roleFilter !== 'all' || statusFilter !== 'all') && (
                  <button onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all') }}
                    className="text-primary font-semibold hover:underline">Clear filters</button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddUserModal open={addOpen} onClose={() => setAddOpen(false)} onCreated={user => setUsers(prev => [user, ...prev])} token={token} />
      <EditUserModal user={editTarget} selfId={selfId} open={!!editTarget} onClose={() => setEditTarget(null)} onUpdated={updated => setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))} token={token} />
      <ResetPasswordModal user={resetTarget} open={!!resetTarget} onClose={() => setResetTarget(null)} token={token} />
      <DeleteDialog user={deleteTarget} open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={id => setUsers(prev => prev.filter(u => u.id !== id))} token={token} />
    </div>
  )
}
