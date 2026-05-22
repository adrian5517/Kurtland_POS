'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Plus, Edit2, Trash2, Search, Shield } from 'lucide-react'

// Mock users data
const MOCK_USERS = [
  { id: '1', email: 'admin@kurtland.com', fullName: 'John Admin', role: 'admin', status: 'active', lastLogin: '2 hours ago' },
  { id: '2', email: 'manager@kurtland.com', fullName: 'Sarah Manager', role: 'manager', status: 'active', lastLogin: '30 mins ago' },
  { id: '3', email: 'cashier1@kurtland.com', fullName: 'Maria Santos', role: 'cashier', status: 'active', lastLogin: '5 mins ago' },
  { id: '4', email: 'cashier2@kurtland.com', fullName: 'Juan Dela Cruz', role: 'cashier', status: 'active', lastLogin: '1 hour ago' },
  { id: '5', email: 'cashier3@kurtland.com', fullName: 'Anna Garcia', role: 'cashier', status: 'inactive', lastLogin: '2 days ago' },
]

const ROLES = [
  { value: 'admin', label: 'Administrator', color: 'bg-primary/20 text-primary' },
  { value: 'manager', label: 'Manager', color: 'bg-blue-500/20 text-blue-600' },
  { value: 'cashier', label: 'Cashier', color: 'bg-green-500/20 text-green-600' },
]

export default function UsersPage() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddingUser, setIsAddingUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', fullName: '', role: 'cashier' })

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddUser = () => {
    if (!newUser.email || !newUser.fullName) {
      toast.error('Please fill in all fields')
      return
    }
    const user = {
      id: Date.now().toString(),
      ...newUser,
      status: 'active',
      lastLogin: 'Never',
    }
    setUsers([...users, user])
    toast.success(`User ${newUser.fullName} added successfully`)
    setNewUser({ email: '', fullName: '', role: 'cashier' })
    setIsAddingUser(false)
  }

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id)
    setUsers(users.filter(u => u.id !== id))
    toast.success(`${user?.fullName} has been removed`)
  }

  const handleToggleStatus = (id: string) => {
    setUsers(users.map(u =>
      u.id === id ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u
    ))
    const user = users.find(u => u.id === id)
    const newStatus = user?.status === 'active' ? 'inactive' : 'active'
    toast.success(`${user?.fullName} is now ${newStatus}`)
  }

  const getRoleColor = (role: string) => {
    return ROLES.find(r => r.value === role)?.color || ''
  }

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Users Management</h1>
          <p className="text-sm text-muted-foreground">Manage team members, roles, and access permissions.</p>
        </div>
        <Button
          onClick={() => setIsAddingUser(true)}
          className="w-full sm:w-auto gap-2 rounded-2xl bg-primary px-5 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{users.length}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{users.filter(u => u.status === 'active').length}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95 sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{users.filter(u => u.role === 'admin').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-2xl border-primary/20 bg-card/95 pl-10 shadow-sm focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
        />
      </div>

      {/* Users Table */}
      <Card className="w-full overflow-hidden rounded-3xl border-primary/20 bg-card/95 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-primary/20 bg-muted/80 backdrop-blur">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Email</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Role</th>
                  <th className="px-6 py-3 text-left font-semibold text-foreground">Last Login</th>
                  <th className="px-6 py-3 text-center font-semibold text-foreground">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`border-b border-primary/10 hover:bg-muted/50 transition-colors ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                  >
                    <td className="px-6 py-4 font-medium text-foreground">{user.fullName}</td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(user.role)}`}>
                        {ROLES.find(r => r.value === user.role)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">{user.lastLogin}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'active'
                          ? 'bg-green-500/20 text-green-600'
                          : 'bg-gray-500/20 text-gray-600'
                      }`}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(user.id)}
                          className="h-9 w-9 rounded-xl p-0 border-primary/20"
                        >
                          <Shield className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="h-9 w-9 rounded-xl p-0 border-secondary/20 text-secondary hover:bg-secondary/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md rounded-3xl border-primary/20 bg-card/95 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-primary">Add New User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Full Name</Label>
                <Input
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  placeholder="John Doe"
                  className="rounded-xl border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="john@example.com"
                  className="rounded-xl border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Role</Label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full rounded-xl border border-primary/20 bg-background px-3 py-2 text-foreground"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingUser(false)}
                  className="flex-1 rounded-xl border-primary/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddUser}
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
                >
                  Add User
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
