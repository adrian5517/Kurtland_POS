'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogOut, ShoppingCart, Boxes, BarChart3,
  Users, Settings, Menu, X,
  ChevronLeft, ChevronRight, Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { clearAuthSession, getAuthSession } from '@/lib/auth'
import type { AuthSession } from '@/lib/auth'
import { apiFetch, apiHeaders } from '@/lib/api'

const BUDGET_SEEN_KEY = 'kurtland-budget-seen-at'

function useBudgetNotification(token: string | undefined, role: string, pathname: string) {
  const [hasDot, setHasDot] = useState(false)

  // Mark as seen when visiting the page
  useEffect(() => {
    if (pathname === '/dashboard/budget-requests') {
      localStorage.setItem(BUDGET_SEEN_KEY, new Date().toISOString())
      setHasDot(false)
    }
  }, [pathname])

  // Check for new items on mount and every 30 s
  useEffect(() => {
    if (!token) return
    let cancelled = false

    async function check() {
      const seenAt = localStorage.getItem(BUDGET_SEEN_KEY) ?? '1970-01-01T00:00:00.000Z'
      try {
        const res = await apiFetch('/api/budget-requests', { headers: apiHeaders(token!) })
        if (!res.ok || cancelled) return
        const { data } = await res.json()
        const items: Array<{ status: string; created_at: string; reviewed_at?: string }> = data ?? []
        const hasNew = role === 'admin'
          ? items.some(r => r.status === 'pending' && r.created_at > seenAt)
          : items.some(r => r.status !== 'pending' && r.reviewed_at != null && r.reviewed_at > seenAt)
        if (!cancelled && pathname !== '/dashboard/budget-requests') setHasDot(hasNew)
      } catch { /* silent */ }
    }

    check()
    const id = setInterval(check, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [token, role])

  return hasDot
}

const NAV_ITEMS = [
  { href: '/dashboard',                    label: 'POS',                 icon: ShoppingCart, adminOnly: false },
  { href: '/dashboard/inventory',          label: 'Inventory',           icon: Boxes,        adminOnly: true  },
  { href: '/dashboard/cashier-analytics',  label: 'Cashier Analytics',   icon: BarChart3,    adminOnly: true  },
  { href: '/dashboard/reports',            label: 'Reports',             icon: BarChart3,    adminOnly: true  },
  { href: '/dashboard/users',              label: 'Users',               icon: Users,        adminOnly: true  },
  { href: '/dashboard/budget-requests',    label: 'Budget Requests',     icon: Wallet,       adminOnly: false },
  { href: '/dashboard/settings',           label: 'Settings',            icon: Settings,     adminOnly: false },
]

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  adminOnly: boolean
}

type InitialsProps = {
  email: string
  role: AuthSession['user']['role']
}

type NavLinkProps = {
  item: NavItem
  collapsed: boolean
  hasDot?: boolean
  onClick?: () => void
}

// ─── Avatar initials ──────────────────────────────────────────────────────────
function Initials({ email, role }: InitialsProps) {
  const letters = (email || 'KP').split('@')[0].slice(0, 2).toUpperCase()
  const palette = {
    admin:   { bg: '#cf863922', border: '#f28c1f55', text: '#f28c1f' },
    cashier: { bg: '#3b82f622', border: '#3b82f655', text: '#93c5fd' },
  }
  const { bg, border, text } = palette[role] ?? palette.cashier
  return (
    <span
      style={{ background: bg, border: `1px solid ${border}`, color: text }}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wider"
    >
      {letters}
    </span>
  )
}

// ─── Single nav link ──────────────────────────────────────────────────────────
function NavLink({ item, collapsed, hasDot = false, onClick }: NavLinkProps) {
  const pathname = usePathname()
  const Icon = item.icon
  const isActive = pathname === item.href

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`
        group relative flex items-center gap-3 rounded-xl px-3 py-2.5
        text-sm font-medium transition-all duration-150
        ${isActive
          ? 'bg-[#f28c1f] text-white shadow-lg shadow-[#f28c1f]/25'
          : 'text-white/60 hover:bg-white/8 hover:text-white/90'
        }
        ${collapsed ? 'justify-center' : ''}
      `}
    >
      {/* Active accent bar */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white/60" />
      )}

      <span className="relative shrink-0">
        <Icon
          className={`h-[18px] w-[18px] block transition-transform duration-150
            ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/80'}
            ${!isActive && !collapsed ? 'group-hover:scale-110' : ''}
          `}
        />
        {hasDot && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#1e2a31]" />
        )}
      </span>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardNav() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [session, setSession] = useState<AuthSession | null>(null)
  const pathname = usePathname()

  useEffect(() => { setSession(getAuthSession()) }, [])

  const token = session?.token

  const role = session?.user?.role ?? 'cashier'
  const email = session?.user?.email ?? (role === 'admin' ? 'admin@kurtland.com' : 'cashier@kurtland.com')
  const budgetDot = useBudgetNotification(token, role, pathname)

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter(item => role === 'admin' || !item.adminOnly),
    [role]
  )

  const handleLogout = () => {
    setIsLoggingOut(true)
    clearAuthSession()
    toast.success('Logged out successfully')
    setTimeout(() => { window.location.href = '/' }, 500)
  }

  const SIDEBAR_W = collapsed ? '64px' : '208px'

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/8 bg-[#1e2a31]/90 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img src="/kurtland_logo.png" alt="" className="h-7 w-7 rounded-lg object-contain" />
          <span className="text-sm font-semibold tracking-wide text-white">Kurtland POS</span>
        </div>

        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
      </header>

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className="sticky top-0 hidden h-screen flex-col border-r border-white/8 bg-[#1e2a31] lg:flex"
        style={{ width: SIDEBAR_W, transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-3">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5 overflow-hidden"
              >
                <img src="/kurtland_logo.png" alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />
                <div className="overflow-hidden">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f28c1f]/80">Kurtland</p>
                  <p className="text-sm font-bold text-white leading-none">Dashboard</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setCollapsed(c => !c)}
            className={`
              flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
              border border-white/10 bg-white/5 text-white/50
              transition hover:bg-white/10 hover:text-white
              ${collapsed ? 'mx-auto' : ''}
            `}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />
            }
          </button>
        </div>

        {/* Role badge (expanded only) */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden px-3 pt-4"
            >
              <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-3 py-2">
                <Initials email={email} role={role} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-white/80">{email}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                    {role}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed avatar */}
        {collapsed && (
          <div className="flex justify-center pt-4">
            <Initials email={email} role={role} />
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              hasDot={item.href === '/dashboard/budget-requests' && budgetDot}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/8 p-2">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            title={collapsed ? 'Logout' : undefined}
            className={`
              flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5
              text-sm font-medium text-white/50 transition-all duration-150
              hover:bg-white/8 hover:text-white/80 disabled:opacity-40
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {isLoggingOut ? 'Logging out…' : 'Logout'}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </aside>

      {/* ── Mobile off-canvas ────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/8 bg-[#1e2a31]"
            >
              {/* Drawer header */}
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-4">
                <div className="flex items-center gap-2.5">
                  <img src="/kurtland_logo.png" alt="" className="h-7 w-7 rounded-lg object-contain" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f28c1f]/80">Kurtland</p>
                    <p className="text-sm font-bold text-white leading-none">Dashboard</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* User info */}
              <div className="px-4 pt-4">
                <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/4 px-3 py-2.5">
                  <Initials email={email} role={role} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white/80">{email}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${role === 'admin' ? 'bg-[#f28c1f]' : 'bg-blue-400'}`}
                      />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{role}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nav */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {/* Section label */}
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25">
                  Navigation
                </p>
                {visibleNavItems.map(item => (
                  <NavLink
                    key={item.href}
                    item={item}
                    collapsed={false}
                    hasDot={item.href === '/dashboard/budget-requests' && budgetDot}
                    onClick={() => setMobileOpen(false)}
                  />
                ))}
              </nav>

              {/* Logout */}
              <div className="shrink-0 border-t border-white/8 p-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition hover:bg-white/8 hover:text-white/80 disabled:opacity-40"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  <span>{isLoggingOut ? 'Logging out…' : 'Logout'}</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}