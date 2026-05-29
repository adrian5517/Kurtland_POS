'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Wallet, Plus, CheckCircle2, XCircle, Clock,
  RefreshCw, TrendingDown, AlertCircle, FileText, Info, TrendingUp,
  Undo2, ArrowLeftRight,
} from 'lucide-react'
import { getAuthSession } from '@/lib/auth'
import { apiFetch, apiHeaders } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetRequest = {
  id: number
  cashierId: number
  cashierName: string | null
  cashierEmail: string | null
  amount: number
  reason: string
  cashierNote: string | null
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
}

type Summary = {
  total: number
  pending: number
  approved: number
  rejected: number
  totalApprovedAmount: number
  totalRevenue: number
  netRevenue: number
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

type CashierLimit = {
  totalRevenue: number
  totalApproved: number
  totalPending: number
  remaining: number
  utilizationPercent: number
}

type CashierStat = {
  cashierId: number
  cashierEmail: string
  cashierName: string | null
  totalRevenue: number
  totalApproved: number
  totalPending: number
  remaining: number
}

type BudgetReturn = {
  id: number
  budgetRequestId: number
  cashierId: number
  cashierName: string | null
  cashierEmail: string | null
  originalAmount: number
  amount: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  adminNote: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
}

type PageView = 'requests' | 'returns'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: BudgetRequest['status'] }) {
  if (status === 'approved') return (
    <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
      <CheckCircle2 className="h-3 w-3" /> Approved
    </Badge>
  )
  if (status === 'rejected') return (
    <Badge className="gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
      <XCircle className="h-3 w-3" /> Rejected
    </Badge>
  )
  return (
    <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
      <Clock className="h-3 w-3" /> Pending
    </Badge>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BudgetRequestsPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [token, setToken] = useState('')
  const [requests, setRequests] = useState<BudgetRequest[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // New request modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ amount: '', reason: '', cashierNote: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cashierLimit, setCashierLimit] = useState<CashierLimit | null>(null)
  const [isLoadingLimit, setIsLoadingLimit] = useState(false)

  // Review modal (admin)
  const [reviewTarget, setReviewTarget] = useState<BudgetRequest | null>(null)
  const [reviewForm, setReviewForm] = useState({ status: 'approved' as 'approved' | 'rejected', adminNote: '' })
  const [isReviewing, setIsReviewing] = useState(false)
  const [cashierStatsMap, setCashierStatsMap] = useState<Record<number, CashierStat>>({})

  // View toggle
  const [view, setView] = useState<PageView>('requests')

  // Returns data
  const [returns, setReturns] = useState<BudgetReturn[]>([])
  const [isLoadingReturns, setIsLoadingReturns] = useState(false)
  const [returnsFilter, setReturnsFilter] = useState<StatusFilter>('all')

  // Return submit modal (cashier)
  const [returnTarget, setReturnTarget] = useState<BudgetRequest | null>(null)
  const [returnForm, setReturnForm] = useState({ amount: '', reason: '' })
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)

  // Return review modal (admin)
  const [returnReviewTarget, setReturnReviewTarget] = useState<BudgetReturn | null>(null)
  const [returnReviewForm, setReturnReviewForm] = useState({ status: 'approved' as 'approved' | 'rejected', adminNote: '' })
  const [isReviewingReturn, setIsReviewingReturn] = useState(false)

  useEffect(() => {
    const session = getAuthSession()
    setIsAdmin(session?.user?.role === 'admin')
    setToken(session?.token ?? '')
  }, [])

  const headers = useCallback(() => ({
    ...Object.fromEntries(apiHeaders(token).entries()),
    'Content-Type': 'application/json',
  }), [token])

  const loadData = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const calls: Promise<Response>[] = [
        apiFetch(`/api/budget-requests${params}`, { headers: apiHeaders(token) }),
        apiFetch('/api/budget-requests/summary', { headers: apiHeaders(token) }),
      ]
      if (isAdmin) calls.push(apiFetch('/api/budget-requests/cashier-stats', { headers: apiHeaders(token) }))

      const results = await Promise.all(calls)
      if (results.some((r) => !r.ok)) throw new Error('Failed to load data')
      const [listData, summaryData, statsData] = await Promise.all(results.map((r) => r.json()))
      setRequests(listData.data)
      setSummary(summaryData.data)
      if (isAdmin && statsData) {
        const map: Record<number, CashierStat> = {}
        for (const s of statsData.data as CashierStat[]) map[s.cashierId] = s
        setCashierStatsMap(map)
      }
    } catch {
      toast.error('Failed to load budget requests')
    } finally {
      setIsLoading(false)
    }
  }, [token, statusFilter, isAdmin])

  useEffect(() => {
    if (token) loadData()
  }, [loadData, token])

  const openNewModal = async () => {
    setShowNewModal(true)
    if (!token || isAdmin) return
    setIsLoadingLimit(true)
    try {
      const res = await apiFetch('/api/budget-requests/my-limit', { headers: apiHeaders(token) })
      if (res.ok) {
        const { data } = await res.json()
        setCashierLimit(data)
      }
    } catch { /* silent */ } finally {
      setIsLoadingLimit(false)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(newForm.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!newForm.reason.trim()) { toast.error('Reason is required'); return }
    if (cashierLimit && amount > cashierLimit.remaining) {
      toast.error(`Amount exceeds your available allowance of ${fmt(cashierLimit.remaining)}`)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/api/budget-requests', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          amount,
          reason: newForm.reason.trim(),
          cashierNote: newForm.cashierNote.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to submit request')
      toast.success('Budget request submitted')
      setShowNewModal(false)
      setNewForm({ amount: '', reason: '', cashierNote: '' })
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewTarget) return

    setIsReviewing(true)
    try {
      const res = await apiFetch(`/api/budget-requests/${reviewTarget.id}/review`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          status: reviewForm.status,
          adminNote: reviewForm.adminNote.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to review request')
      toast.success(`Request ${reviewForm.status}`)
      setReviewTarget(null)
      setReviewForm({ status: 'approved', adminNote: '' })
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review request')
    } finally {
      setIsReviewing(false)
    }
  }

  const openReview = (req: BudgetRequest) => {
    setReviewTarget(req)
    setReviewForm({ status: 'approved', adminNote: '' })
  }

  const loadReturns = useCallback(async () => {
    if (!token) return
    setIsLoadingReturns(true)
    try {
      const params = returnsFilter !== 'all' ? `?status=${returnsFilter}` : ''
      const res = await apiFetch(`/api/budget-returns${params}`, { headers: apiHeaders(token) })
      if (!res.ok) throw new Error()
      const { data } = await res.json()
      setReturns(data)
    } catch {
      toast.error('Failed to load budget returns')
    } finally {
      setIsLoadingReturns(false)
    }
  }, [token, returnsFilter])

  useEffect(() => {
    if (token && view === 'returns') loadReturns()
  }, [loadReturns, token, view])

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnTarget) return
    const amount = parseFloat(returnForm.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (!returnForm.reason.trim()) { toast.error('Reason is required'); return }

    setIsSubmittingReturn(true)
    try {
      const res = await apiFetch('/api/budget-returns', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          budgetRequestId: returnTarget.id,
          amount,
          reason: returnForm.reason.trim(),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to submit return')
      toast.success('Budget return submitted — awaiting admin approval')
      setReturnTarget(null)
      setReturnForm({ amount: '', reason: '' })
      loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit return')
    } finally {
      setIsSubmittingReturn(false)
    }
  }

  const handleReviewReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!returnReviewTarget) return

    setIsReviewingReturn(true)
    try {
      const res = await apiFetch(`/api/budget-returns/${returnReviewTarget.id}/review`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          status: returnReviewForm.status,
          adminNote: returnReviewForm.adminNote.trim() || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || 'Failed to review return')
      toast.success(`Return ${returnReviewForm.status}`)
      setReturnReviewTarget(null)
      setReturnReviewForm({ status: 'approved', adminNote: '' })
      loadReturns()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to review return')
    } finally {
      setIsReviewingReturn(false)
    }
  }
    <div className="w-full max-w-none space-y-6 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Budget Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Review and manage cashier restock budget requests and returns.'
              : 'Request budget for restocking, track submissions, and return excess funds.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => view === 'requests' ? loadData() : loadReturns()}
            disabled={isLoading || isLoadingReturns}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${(isLoading || isLoadingReturns) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {!isAdmin && view === 'requests' && (
            <Button size="sm" className="gap-1.5" onClick={openNewModal}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          )}
        </div>
      </div>

      {/* ── View Toggle ── */}
      <div className="flex gap-1 bg-muted/60 rounded-xl p-1 w-fit border">
        <button
          onClick={() => setView('requests')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            view === 'requests'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Requests
        </button>
        <button
          onClick={() => setView('returns')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
            view === 'returns'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Undo2 className="h-3.5 w-3.5" />
          Returns
        </button>
      </div>

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Pending"
            value={summary.pending}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            bg="bg-amber-50 dark:bg-amber-950/20"
            border="border-amber-200 dark:border-amber-800/40"
            valueClass="text-amber-600"
          />
          <SummaryCard
            label="Approved"
            value={summary.approved}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            bg="bg-emerald-50 dark:bg-emerald-950/20"
            border="border-emerald-200 dark:border-emerald-800/40"
            valueClass="text-emerald-600"
          />
          {isAdmin ? (
            <>
              <SummaryCard
                label="Total Allocated"
                value={fmt(summary.totalApprovedAmount)}
                icon={<Wallet className="h-4 w-4 text-primary" />}
                bg="bg-primary/5"
                border="border-primary/20"
                valueClass="text-primary text-sm"
              />
              <SummaryCard
                label="Net Revenue"
                value={fmt(summary.netRevenue)}
                icon={<TrendingDown className="h-4 w-4 text-foreground" />}
                bg="bg-muted/50"
                border="border-border"
                valueClass="text-foreground text-sm"
                sub={`Revenue ${fmt(summary.totalRevenue)} − Budget ${fmt(summary.totalApprovedAmount)}`}
              />
            </>
          ) : (
            <>
              <SummaryCard
                label="Approved Amount"
                value={fmt(summary.totalApprovedAmount)}
                icon={<Wallet className="h-4 w-4 text-emerald-500" />}
                bg="bg-emerald-50 dark:bg-emerald-950/20"
                border="border-emerald-200 dark:border-emerald-800/40"
                valueClass="text-emerald-600 text-sm"
              />
              <SummaryCard
                label="Total Requests"
                value={summary.total}
                icon={<FileText className="h-4 w-4 text-muted-foreground" />}
                bg="bg-muted/50"
                border="border-border"
                valueClass="text-foreground"
              />
            </>
          )}
        </div>
      )}

      {/* ── Requests View ── */}
      {view === 'requests' && (
        <>
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b pb-0">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                  statusFilter === s
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Requests List */}
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <Wallet className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No requests found</p>
              <p className="text-sm text-muted-foreground">
                {statusFilter !== 'all'
                  ? `No ${statusFilter} requests.`
                  : isAdmin ? 'No budget requests have been submitted yet.' : 'You haven\'t submitted any requests yet.'}
              </p>
              {!isAdmin && (
                <Button size="sm" className="mt-1 gap-1.5" onClick={openNewModal}>
                  <Plus className="h-4 w-4" /> New Request
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <RequestRow
                  key={req.id}
                  req={req}
                  isAdmin={isAdmin}
                  onReview={openReview}
                  onReturn={!isAdmin && req.status === 'approved' ? (r) => { setReturnTarget(r); setReturnForm({ amount: '', reason: '' }) } : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Returns View ── */}
      {view === 'returns' && (
        <>
          {/* Returns info banner */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 p-3 flex items-start gap-2.5">
            <ArrowLeftRight className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-blue-700">Budget Turnover / Return</p>
              <p className="text-xs text-blue-600">
                {isAdmin
                  ? 'Review cashier budget return requests. Approved returns free up allowance for future requests.'
                  : 'Return excess approved budget back to the pool. Submit a return on any approved request — it will be reviewed by the admin.'}
              </p>
            </div>
          </div>

          {/* Returns Filter Tabs */}
          <div className="flex items-center gap-1 border-b pb-0">
            {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setReturnsFilter(s)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                  returnsFilter === s
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Returns List */}
          {isLoadingReturns ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                <Undo2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No returns found</p>
              <p className="text-sm text-muted-foreground">
                {returnsFilter !== 'all'
                  ? `No ${returnsFilter} returns.`
                  : isAdmin
                  ? 'No cashiers have submitted a budget return yet.'
                  : 'You haven\'t submitted any budget returns yet. Go to Requests and click "Return Budget" on an approved request.'}
              </p>
              {!isAdmin && (
                <Button size="sm" variant="outline" className="mt-1 gap-1.5" onClick={() => setView('requests')}>
                  <FileText className="h-3.5 w-3.5" /> View My Requests
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {returns.map((ret) => (
                <ReturnRow
                  key={ret.id}
                  ret={ret}
                  isAdmin={isAdmin}
                  onReview={isAdmin ? (r) => { setReturnReviewTarget(r); setReturnReviewForm({ status: 'approved', adminNote: '' }) } : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── New Request Modal ── */}
      <Dialog open={showNewModal} onOpenChange={(open) => { if (!open) { setShowNewModal(false); setCashierLimit(null) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              New Budget Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitRequest} className="space-y-4 pt-1">

            {/* Budget allowance panel */}
            {isLoadingLimit && (
              <div className="h-16 rounded-xl bg-muted animate-pulse" />
            )}
            {!isLoadingLimit && cashierLimit && (
              <div className={`rounded-xl border p-3 space-y-2 ${
                cashierLimit.remaining <= 0
                  ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                  : cashierLimit.utilizationPercent >= 75
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20'
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your Budget Allowance</p>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Your Revenue</p>
                    <p className="text-xs font-bold text-foreground">{fmt(cashierLimit.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Allocated</p>
                    <p className="text-xs font-bold text-amber-600">{fmt(cashierLimit.totalApproved + cashierLimit.totalPending)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Available</p>
                    <p className={`text-xs font-bold ${cashierLimit.remaining <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {fmt(cashierLimit.remaining)}
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Progress
                    value={cashierLimit.utilizationPercent}
                    className={`h-1.5 ${
                      cashierLimit.remaining <= 0 ? '[&>div]:bg-red-500'
                      : cashierLimit.utilizationPercent >= 75 ? '[&>div]:bg-amber-500'
                      : '[&>div]:bg-emerald-500'
                    }`}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">{cashierLimit.utilizationPercent.toFixed(1)}% used</p>
                </div>
                {cashierLimit.remaining <= 0 && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    No remaining allowance. Wait for pending requests to be reviewed or revenue to increase.
                  </p>
                )}
              </div>
            )}
            {!isLoadingLimit && !cashierLimit && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3">
                <p className="text-xs text-blue-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Your request amount cannot exceed your total recorded sales revenue.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="req-amount">Amount (PHP) <span className="text-destructive">*</span></Label>
              <Input
                id="req-amount"
                type="number"
                min="1"
                max={cashierLimit?.remaining ?? undefined}
                step="0.01"
                placeholder={cashierLimit ? `Max: ${fmt(cashierLimit.remaining)}` : 'e.g. 1500.00'}
                value={newForm.amount}
                onChange={(e) => setNewForm((f) => ({ ...f, amount: e.target.value }))}
                disabled={isSubmitting || (cashierLimit?.remaining ?? 1) <= 0}
              />
              {cashierLimit && newForm.amount && parseFloat(newForm.amount) > cashierLimit.remaining && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Exceeds your available allowance of {fmt(cashierLimit.remaining)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-reason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="req-reason"
                placeholder="e.g. Need to restock beverages and snacks for next week..."
                rows={3}
                value={newForm.reason}
                onChange={(e) => setNewForm((f) => ({ ...f, reason: e.target.value }))}
                disabled={isSubmitting}
                maxLength={500}
              />
              <p className="text-[11px] text-muted-foreground text-right">{newForm.reason.length}/500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-note">Additional Note <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="req-note"
                placeholder="Any extra details for the admin..."
                rows={2}
                value={newForm.cashierNote}
                onChange={(e) => setNewForm((f) => ({ ...f, cashierNote: e.target.value }))}
                disabled={isSubmitting}
                maxLength={500}
              />
            </div>
            <DialogFooter className="pt-1">
              <Button type="button" variant="outline" onClick={() => { setShowNewModal(false); setCashierLimit(null) }} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (!!cashierLimit && cashierLimit.remaining <= 0)}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Submitting…
                  </span>
                ) : 'Submit Request'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Review Modal (admin) ── */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) setReviewTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Review Request
            </DialogTitle>
          </DialogHeader>
          {reviewTarget && (
            <form onSubmit={handleReview} className="space-y-4 pt-1">
              {/* Request summary */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cashier</span>
                  <span className="font-medium">{reviewTarget.cashierName || reviewTarget.cashierEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested</span>
                  <span className="font-semibold text-primary">{fmt(reviewTarget.amount)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="font-medium">{reviewTarget.reason}</span>
                </div>
                {reviewTarget.cashierNote && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Cashier note</span>
                    <span className="text-foreground">{reviewTarget.cashierNote}</span>
                  </div>
                )}
              </div>

              {/* Cashier revenue context */}
              {cashierStatsMap[reviewTarget.cashierId] && (() => {
                const stat = cashierStatsMap[reviewTarget.cashierId]
                const used = stat.totalApproved + stat.totalPending
                const pct = stat.totalRevenue > 0 ? Math.min(100, (used / stat.totalRevenue) * 100) : 0
                return (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Cashier Budget Context
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                        <p className="text-xs font-bold text-foreground">{fmt(stat.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Allocated</p>
                        <p className="text-xs font-bold text-amber-600">{fmt(used)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Remaining</p>
                        <p className={`text-xs font-bold ${stat.remaining <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {fmt(stat.remaining)}
                        </p>
                      </div>
                    </div>
                    <Progress
                      value={pct}
                      className={`h-1.5 ${
                        pct >= 100 ? '[&>div]:bg-red-500'
                        : pct >= 75 ? '[&>div]:bg-amber-500'
                        : '[&>div]:bg-emerald-500'
                      }`}
                    />
                  </div>
                )
              })()}

              <div className="space-y-2">
                <Label>Decision <span className="text-destructive">*</span></Label>
                <Select
                  value={reviewForm.status}
                  onValueChange={(v) => setReviewForm((f) => ({ ...f, status: v as 'approved' | 'rejected' }))}
                  disabled={isReviewing}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">
                      <span className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </span>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <span className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-note">
                  Admin Note{' '}
                  {reviewForm.status === 'rejected'
                    ? <span className="text-destructive">*</span>
                    : <span className="text-muted-foreground text-xs">(optional)</span>}
                </Label>
                <Textarea
                  id="admin-note"
                  placeholder={
                    reviewForm.status === 'approved'
                      ? 'e.g. Approved for next week restock cycle'
                      : 'e.g. Budget limit reached this month, resubmit next month'
                  }
                  rows={3}
                  value={reviewForm.adminNote}
                  onChange={(e) => setReviewForm((f) => ({ ...f, adminNote: e.target.value }))}
                  disabled={isReviewing}
                  maxLength={500}
                />
              </div>

              {reviewForm.status === 'rejected' && !reviewForm.adminNote.trim() && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600">
                  <AlertCircle className="h-3 w-3" /> Please provide a reason when rejecting
                </p>
              )}

              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" onClick={() => setReviewTarget(null)} disabled={isReviewing}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReviewing || (reviewForm.status === 'rejected' && !reviewForm.adminNote.trim())}
                  className={reviewForm.status === 'rejected' ? 'bg-destructive hover:bg-destructive/90' : ''}
                >
                  {isReviewing ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Saving…
                    </span>
                  ) : reviewForm.status === 'approved' ? 'Approve Request' : 'Reject Request'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Return Submit Modal (cashier) ── */}
      <Dialog open={!!returnTarget} onOpenChange={(open) => { if (!open) setReturnTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-primary" />
              Return Budget
            </DialogTitle>
          </DialogHeader>
          {returnTarget && (
            <form onSubmit={handleSubmitReturn} className="space-y-4 pt-1">
              {/* Original request summary */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Original Approved Request</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Approved Amount</span>
                  <span className="font-semibold text-emerald-600">{fmt(returnTarget.amount)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Reason</span>
                  <span className="text-foreground text-xs">{returnTarget.reason}</span>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Enter the amount you want to return. It must not exceed the original approved amount. This return requires admin approval.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-amount">Return Amount (PHP) <span className="text-destructive">*</span></Label>
                <Input
                  id="return-amount"
                  type="number"
                  min="0.01"
                  max={returnTarget.amount}
                  step="0.01"
                  placeholder={`Max: ${fmt(returnTarget.amount)}`}
                  value={returnForm.amount}
                  onChange={(e) => setReturnForm((f) => ({ ...f, amount: e.target.value }))}
                  disabled={isSubmittingReturn}
                />
                {returnForm.amount && parseFloat(returnForm.amount) > returnTarget.amount && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Exceeds the original approved amount of {fmt(returnTarget.amount)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-reason">Reason for Return <span className="text-destructive">*</span></Label>
                <Textarea
                  id="return-reason"
                  placeholder="e.g. Purchased less than expected, returning excess funds..."
                  rows={3}
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm((f) => ({ ...f, reason: e.target.value }))}
                  disabled={isSubmittingReturn}
                  maxLength={500}
                />
                <p className="text-[11px] text-muted-foreground text-right">{returnForm.reason.length}/500</p>
              </div>

              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" onClick={() => setReturnTarget(null)} disabled={isSubmittingReturn}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingReturn}>
                  {isSubmittingReturn ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Submitting…
                    </span>
                  ) : 'Submit Return'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Return Review Modal (admin) ── */}
      <Dialog open={!!returnReviewTarget} onOpenChange={(open) => { if (!open) setReturnReviewTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-primary" />
              Review Budget Return
            </DialogTitle>
          </DialogHeader>
          {returnReviewTarget && (
            <form onSubmit={handleReviewReturn} className="space-y-4 pt-1">
              {/* Return summary */}
              <div className="rounded-xl border bg-muted/40 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cashier</span>
                  <span className="font-medium">{returnReviewTarget.cashierName || returnReviewTarget.cashierEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Return Amount</span>
                  <span className="font-semibold text-amber-600">{fmt(returnReviewTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From Approved Request</span>
                  <span className="font-medium text-foreground">{fmt(returnReviewTarget.originalAmount)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground">Return Reason</span>
                  <span className="font-medium">{returnReviewTarget.reason}</span>
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                <p className="text-xs text-emerald-700 flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Approving this return will free up <span className="font-semibold mx-1">{fmt(returnReviewTarget.amount)}</span>
                  back into the cashier's budget allowance.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Decision <span className="text-destructive">*</span></Label>
                <Select
                  value={returnReviewForm.status}
                  onValueChange={(v) => setReturnReviewForm((f) => ({ ...f, status: v as 'approved' | 'rejected' }))}
                  disabled={isReviewingReturn}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">
                      <span className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve Return
                      </span>
                    </SelectItem>
                    <SelectItem value="rejected">
                      <span className="flex items-center gap-2 text-red-600">
                        <XCircle className="h-3.5 w-3.5" /> Reject Return
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return-admin-note">
                  Admin Note{' '}
                  {returnReviewForm.status === 'rejected'
                    ? <span className="text-destructive">*</span>
                    : <span className="text-muted-foreground text-xs">(optional)</span>}
                </Label>
                <Textarea
                  id="return-admin-note"
                  placeholder={
                    returnReviewForm.status === 'approved'
                      ? 'e.g. Return confirmed, funds released back to allowance'
                      : 'e.g. Return rejected — amount discrepancy, please resubmit'
                  }
                  rows={3}
                  value={returnReviewForm.adminNote}
                  onChange={(e) => setReturnReviewForm((f) => ({ ...f, adminNote: e.target.value }))}
                  disabled={isReviewingReturn}
                  maxLength={500}
                />
              </div>

              {returnReviewForm.status === 'rejected' && !returnReviewForm.adminNote.trim() && (
                <p className="flex items-center gap-1 text-[11px] text-amber-600">
                  <AlertCircle className="h-3 w-3" /> Please provide a reason when rejecting
                </p>
              )}

              <DialogFooter className="pt-1">
                <Button type="button" variant="outline" onClick={() => setReturnReviewTarget(null)} disabled={isReviewingReturn}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReviewingReturn || (returnReviewForm.status === 'rejected' && !returnReviewForm.adminNote.trim())}
                  className={returnReviewForm.status === 'rejected' ? 'bg-destructive hover:bg-destructive/90' : ''}
                >
                  {isReviewingReturn ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Saving…
                    </span>
                  ) : returnReviewForm.status === 'approved' ? 'Approve Return' : 'Reject Return'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, icon, bg, border, valueClass, sub,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  bg: string
  border: string
  valueClass?: string
  sub?: string
}) {
  return (
    <div className={`rounded-2xl border p-4 ${bg} ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  )
}

function RequestRow({
  req, isAdmin, onReview, onReturn,
}: {
  req: BudgetRequest
  isAdmin: boolean
  onReview: (req: BudgetRequest) => void
  onReturn?: (req: BudgetRequest) => void
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground text-sm">
            {fmt(req.amount)}
          </span>
          <StatusBadge status={req.status} />
          {isAdmin && (
            <span className="text-xs text-muted-foreground">
              by {req.cashierName || req.cashierEmail}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{fmtDate(req.createdAt)}</span>
        </div>
        <p className="text-sm text-foreground">{req.reason}</p>
        {req.cashierNote && (
          <p className="text-xs text-muted-foreground italic">Note: {req.cashierNote}</p>
        )}
        {req.status !== 'pending' && (
          <div className={`mt-1 text-xs rounded-lg px-2.5 py-1.5 inline-flex flex-col gap-0.5 ${
            req.status === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700'
          }`}>
            <span className="font-semibold">
              {req.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
              {req.reviewedByName ? ` by ${req.reviewedByName}` : ''}
              {req.reviewedAt ? ` · ${fmtDate(req.reviewedAt)}` : ''}
            </span>
            {req.adminNote && <span>{req.adminNote}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 self-start">
        {isAdmin && req.status === 'pending' && (
          <Button size="sm" variant="outline" onClick={() => onReview(req)}>
            Review
          </Button>
        )}
        {onReturn && (
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 hover:text-amber-700" onClick={() => onReturn(req)}>
            <Undo2 className="h-3.5 w-3.5" />
            Return Budget
          </Button>
        )}
      </div>
    </div>
  )
}

function ReturnRow({
  ret, isAdmin, onReview,
}: {
  ret: BudgetReturn
  isAdmin: boolean
  onReview?: (ret: BudgetReturn) => void
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-amber-600 text-sm">
            <Undo2 className="h-3.5 w-3.5" />
            {fmt(ret.amount)}
          </span>
          <StatusBadge status={ret.status} />
          {isAdmin && (
            <span className="text-xs text-muted-foreground">
              by {ret.cashierName || ret.cashierEmail}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{fmtDate(ret.createdAt)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          From approved request of <span className="font-medium text-foreground">{fmt(ret.originalAmount)}</span>
        </p>
        <p className="text-sm text-foreground">{ret.reason}</p>
        {ret.status !== 'pending' && (
          <div className={`mt-1 text-xs rounded-lg px-2.5 py-1.5 inline-flex flex-col gap-0.5 ${
            ret.status === 'approved'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700'
          }`}>
            <span className="font-semibold">
              {ret.status === 'approved' ? '✓ Return Approved' : '✗ Return Rejected'}
              {ret.reviewedByName ? ` by ${ret.reviewedByName}` : ''}
              {ret.reviewedAt ? ` · ${fmtDate(ret.reviewedAt)}` : ''}
            </span>
            {ret.adminNote && <span>{ret.adminNote}</span>}
          </div>
        )}
      </div>
      {isAdmin && ret.status === 'pending' && onReview && (
        <Button size="sm" variant="outline" className="shrink-0 self-start" onClick={() => onReview(ret)}>
          Review
        </Button>
      )}
    </div>
  )
}
