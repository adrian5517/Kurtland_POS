'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Lock, Bell, BarChart3, Database, Shield, Settings } from 'lucide-react'

export default function SettingsPage() {
  const [formData, setFormData] = useState({
    businessName: 'Kurtland Canteen',
    email: 'admin@kurtland.com',
    phone: '+1 234 567 8900',
    address: '123 Main Street, City',
  })

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    toast.success('Settings saved successfully')
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      toast.error('Please fill in all password fields')
      return
    }

    if (passwordData.new !== passwordData.confirm) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordData.new.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    toast.success('Password changed successfully')
    setPasswordData({ current: '', new: '', confirm: '' })
  }

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage business details, account security, and system status.</p>
        </div>
        <Settings className="w-8 h-8 text-primary hidden sm:block" />
      </div>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Business Information */}
        <Card className="border-primary/10 shadow-sm rounded-3xl bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Business Information
            </CardTitle>
            <CardDescription>Update your business details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Business Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-primary/10 shadow-sm rounded-3xl bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">Current Password</Label>
                <Input
                  id="current"
                  type="password"
                  value={passwordData.current}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, current: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new">New Password</Label>
                <Input
                  id="new"
                  type="password"
                  value={passwordData.new}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, new: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={passwordData.confirm}
                  onChange={(e) =>
                    setPasswordData({ ...passwordData, confirm: e.target.value })
                  }
                />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Security & Privacy */}
      <Card className="border-primary/10 shadow-sm rounded-3xl bg-card/95">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Security & Privacy
          </CardTitle>
          <CardDescription>Manage your security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Two-Factor Authentication */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-primary/10 rounded-2xl bg-muted/30">
              <div>
                <p className="font-semibold text-foreground">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
                Enable
              </Button>
            </div>

            {/* Session Management */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-primary/10 rounded-2xl bg-muted/30">
              <div>
                <p className="font-semibold text-foreground">Active Sessions</p>
                <p className="text-sm text-muted-foreground">
                  Manage devices that can access your account
                </p>
              </div>
              <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
                Manage
              </Button>
            </div>

            {/* API Keys */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border border-primary/10 rounded-2xl bg-muted/30">
              <div>
                <p className="font-semibold text-foreground">API Keys</p>
                <p className="text-sm text-muted-foreground">
                  Create and manage API keys for integrations
                </p>
              </div>
              <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
                Configure
              </Button>
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-primary/5 p-4 rounded-2xl space-y-2 border border-primary/10">
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Database className="w-4 h-4" />
              Data Protection
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
              <li>All data is encrypted using industry-standard AES-256</li>
              <li>Row-Level Security (RLS) protects your information</li>
              <li>Regular security audits and monitoring</li>
              <li>GDPR compliant data handling practices</li>
              <li>Automated backups every 24 hours</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="border-primary/10 shadow-sm rounded-3xl bg-card/95">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Database', status: 'Operational' },
              { name: 'API Server', status: 'Operational' },
              { name: 'Authentication', status: 'Operational' },
              { name: 'Backup Service', status: 'Operational' },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between p-4 border border-primary/10 rounded-2xl bg-muted/30">
                <p className="font-medium text-foreground">{service.name}</p>
                <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary font-semibold">
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
