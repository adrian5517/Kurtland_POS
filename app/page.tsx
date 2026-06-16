'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { saveAuthSession, validateAuthSession } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // If already logged in (valid, non-expired token), skip the login form
  // and go straight to the dashboard.
  useEffect(() => {
    if (validateAuthSession()?.token) {
      router.replace('/dashboard')
    } else {
      setCheckingSession(false)
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please fill in all fields')
      return
    }
    setIsLoading(true)

    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Login failed')
      }

      saveAuthSession(payload.data)
      toast.success(`Welcome back, ${payload.data.user.name || payload.data.user.email}!`)
      router.push('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  // While checking for an existing session, render nothing to avoid flashing
  // the login form before redirecting an already-authenticated user.
  if (checkingSession) {
    return null
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-4 md:p-6 bg-background relative overflow-hidden">
      {/* Subtle background grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Warm glow accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[500px] md:w-[600px] h-[400px] sm:h-[500px] md:h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 px-4 sm:px-0">
        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="bg-card border border-border/50 rounded-2xl shadow-sm p-6 sm:p-8"
        >
          {/* School Logo Inside Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center mb-6 sm:mb-8"
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24">
              <Image
                src="/kurtland_logo.png"
                alt="Kurtland Grade School"
                width={96}
                height={96}
                priority
                className="w-full h-full object-contain"
              />
            </div>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-6 sm:mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Kurtland POS</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">Canteen Management System</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-2 sm:mt-3 font-medium">Kurtland Grade School Inc.</p>
          </motion.div>

          <div className="mb-5 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Sign in</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-1 sm:space-y-1.5"
            >
              <Label htmlFor="email" className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="h-10 sm:h-11 rounded-xl border-border/60 bg-muted/30 text-xs sm:text-sm transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-1 sm:space-y-1.5"
            >
              <Label htmlFor="password" className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-10 sm:h-11 rounded-xl border-border/60 bg-muted/30 text-xs sm:text-sm pr-10 transition-all focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 sm:h-11 rounded-xl font-semibold text-xs sm:text-sm gap-2 mt-1 sm:mt-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
          className="text-center text-[10px] sm:text-xs text-muted-foreground/60 mt-6 sm:mt-8 px-4"
        >
          Secure Authentication · Canteen Management · School Operations
        </motion.p>
      </div>
    </div>
  )
}