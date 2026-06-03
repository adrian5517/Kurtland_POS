'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Lock, LogOut, User, ShieldCheck, Eye, EyeOff,
  RefreshCw, CheckCircle2, Clock, Info, Pencil,
} from 'lucide-react'
import { getAuthSession, saveAuthSession, clearAuthSession, isTokenExpired, type AuthSession } from '@/lib/auth'
import { apiFetch, apiHeaders } from '@/lib/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function formatTokenExpiry(token: string): { label: string; isWarning: boolean } {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    const expiresAt = new Date((payload.exp || 0) * 1000)
    const minutesLeft = Math.floor((expiresAt.getTime() - Date.now()) / 60_000)
    if (minutesLeft <= 0) return { label: 'Expired', isWarning: true }
    if (minutesLeft < 60) return { label: `Session expires in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}`, isWarning: true }
    const hours = Math.floor(minutesLeft / 60)
    const mins = minutesLeft % 60
    const timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours === 1 ? '' : 's'}`
    return { label: `Session expires in ${timeStr}`, isWarning: hours < 2 }
  } catch {
    return { label: 'Unknown', isWarning: false }
  }
}

// ─── Password field with show/hide toggle ─────────────────────────────────────

function PasswordInput({
  id, label, value, onChange, autoComplete, disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  disabled?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="••••••••"
          disabled={disabled}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PasswordForm = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const EMPTY_PASSWORD_FORM: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export default function SettingsPage() {
  const router = useRouter()

  const [session, setSession] = useState<AuthSession | null>(null)
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  useEffect(() => {
    const s = getAuthSession()
    setSession(s)
    if (s?.user) {
      setProfileForm({ name: s.user.name ?? '', email: s.user.email ?? '' })
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const current = getAuthSession()
    if (!current?.token) return
    setIsRefreshingProfile(true)
    try {
      const res = await apiFetch('/api/auth/me', { headers: apiHeaders(current.token) })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      const updated: AuthSession = { ...current, user: { ...current.user, ...data } }
      saveAuthSession(updated)
      setSession(updated)
    } catch {
      toast.error('Could not refresh profile')
    } finally {
      setIsRefreshingProfile(false)
    }
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const { currentPassword, newPassword, confirmPassword } = passwordForm

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all fields')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (currentPassword === newPassword) {
      toast.error('New password must differ from the current one')
      return
    }

    const current = getAuthSession()
    if (!current?.token) { toast.error('Please sign in again'); return }

    setIsChangingPassword(true)
    try {
      const res = await apiFetch('/api/users/me/password', {
        method: 'PATCH',
        headers: {
          ...Object.fromEntries(apiHeaders(current.token).entries()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to change password')
      setPasswordForm(EMPTY_PASSWORD_FORM)
      toast.success('Password changed successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const { name, email } = profileForm
    if (!name.trim()) { toast.error('Name is required'); return }
    if (!email.trim()) { toast.error('Email is required'); return }

    const current = getAuthSession()
    if (!current?.token) { toast.error('Please sign in again'); return }

    setIsUpdatingProfile(true)
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          ...Object.fromEntries(apiHeaders(current.token).entries()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to update profile')
      const updated: AuthSession = { ...current, user: { ...current.user, ...body.data } }
      saveAuthSession(updated)
      setSession(updated)
      toast.success('Profile updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleSignOut = () => {
    clearAuthSession()
    router.push('/')
  }

  const user = session?.user ?? null
  const tokenInfo = session?.token ? formatTokenExpiry(session.token) : null
  const isExpired = session?.token ? isTokenExpired(session.token) : false
  const initials = user ? getInitials(user.name, user.email) : '??'
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const passwordStrength = (() => {
    const p = passwordForm.newPassword
    if (!p) return null
    if (p.length < 8) return { label: 'Too short', color: 'bg-red-500', width: '20%' }
    if (p.length < 10 || !/[0-9]/.test(p) || !/[A-Z]/.test(p)) return { label: 'Fair', color: 'bg-amber-500', width: '55%' }
    if (!/[^a-zA-Z0-9]/.test(p)) return { label: 'Good', color: 'bg-emerald-400', width: '75%' }
    return { label: 'Strong', color: 'bg-emerald-600', width: '100%' }
  })()

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-7 animate-in fade-in duration-300">

      {/* ── Page Header ── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account security and session.</p>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-5">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Account Card */}
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">

              {/* Avatar + info */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-primary">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{user?.name || '—'}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email || '—'}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                    user?.role === 'admin'
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {user?.role ?? '—'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshProfile}
                  disabled={isRefreshingProfile}
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Refresh profile"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingProfile ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* Session status */}
              <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
                isExpired
                  ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/50'
                  : tokenInfo?.isWarning
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/50'
                  : 'bg-muted/50 border-border'
              }`}>
                <Clock className={`h-4 w-4 shrink-0 ${
                  isExpired ? 'text-red-500' : tokenInfo?.isWarning ? 'text-amber-500' : 'text-muted-foreground'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${
                    isExpired ? 'text-red-600' : tokenInfo?.isWarning ? 'text-amber-600' : 'text-foreground'
                  }`}>
                    {isExpired ? 'You have been signed out — please log in again' : (tokenInfo?.label ?? 'You are signed in')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">You will be logged out automatically after 12 hours</p>
                </div>
                {!isExpired && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              </div>

              {/* Sign out */}
              <Button
                variant="outline"
                className="w-full gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive hover:border-destructive/50 transition-colors"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* About Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-primary" />
                About
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <dl className="space-y-3 text-sm">
                {[
                  { label: 'Application', value: 'Kurtland POS' },
                  { label: 'Version', value: 'v1.0.0' },
                  { label: 'API', value: apiUrl },
                  { label: 'Environment', value: process.env.NODE_ENV || 'development' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground shrink-0">{label}</dt>
                    <dd className="font-medium text-foreground text-right truncate max-w-[60%]" title={value}>{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

        </div>

        {/* ── Right column ── */}
        <div className="lg:col-span-3 flex flex-col gap-6">

          {/* Edit Profile Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Profile
              </CardTitle>
              <CardDescription>Update your display name and email address.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profileName">Full Name</Label>
                  <Input
                    id="profileName"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your full name"
                    autoComplete="name"
                    disabled={isUpdatingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileEmail">Email Address</Label>
                  <Input
                    id="profileEmail"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    autoComplete="email"
                    disabled={isUpdatingProfile}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl"
                  disabled={isUpdatingProfile || (!profileForm.name.trim() && !profileForm.email.trim())}
                >
                  {isUpdatingProfile ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Saving…
                    </span>
                  ) : 'Save Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-0 pt-5 px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Must be at least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleChangePassword} className="space-y-5">

                <PasswordInput
                  id="currentPassword"
                  label="Current Password"
                  value={passwordForm.currentPassword}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, currentPassword: v }))}
                  autoComplete="current-password"
                  disabled={isChangingPassword}
                />

                <PasswordInput
                  id="newPassword"
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, newPassword: v }))}
                  autoComplete="new-password"
                  disabled={isChangingPassword}
                />

                {/* Password strength indicator */}
                {passwordStrength && (
                  <div className="space-y-1 -mt-2">
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                    <p className={`text-[11px] font-semibold ${
                      passwordStrength.label === 'Too short' ? 'text-red-500' :
                      passwordStrength.label === 'Fair' ? 'text-amber-500' :
                      'text-emerald-600'
                    }`}>
                      {passwordStrength.label}
                    </p>
                  </div>
                )}

                <PasswordInput
                  id="confirmPassword"
                  label="Confirm New Password"
                  value={passwordForm.confirmPassword}
                  onChange={(v) => setPasswordForm((f) => ({ ...f, confirmPassword: v }))}
                  autoComplete="new-password"
                  disabled={isChangingPassword}
                />

                {/* Match hint */}
                {passwordForm.confirmPassword && (
                  <p className={`-mt-2 text-[11px] font-semibold flex items-center gap-1 ${
                    passwordForm.newPassword === passwordForm.confirmPassword ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {passwordForm.newPassword === passwordForm.confirmPassword
                      ? <><CheckCircle2 className="h-3 w-3" /> Passwords match</>
                      : 'Passwords do not match'
                    }
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full rounded-xl"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Updating…
                    </span>
                  ) : (
                    'Update Password'
                  )}
                </Button>

                {/* Live requirements checklist */}
                <ul className="text-[11px] text-muted-foreground space-y-1.5 pt-1 border-t">
                  {[
                    {
                      label: 'At least 8 characters',
                      met: passwordForm.newPassword.length >= 8,
                    },
                    {
                      label: 'One uppercase letter',
                      met: /[A-Z]/.test(passwordForm.newPassword),
                    },
                    {
                      label: 'One number',
                      met: /[0-9]/.test(passwordForm.newPassword),
                    },
                    {
                      label: 'Different from current password',
                      met: passwordForm.newPassword !== '' && passwordForm.currentPassword !== passwordForm.newPassword,
                    },
                  ].map(({ label, met }) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${met ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
                      <span className={met ? 'text-emerald-600 font-medium' : ''}>{label}</span>
                    </li>
                  ))}
                </ul>

              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}