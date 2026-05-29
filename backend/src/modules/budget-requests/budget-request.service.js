const { HttpError } = require('../../utils/http-error')
const { budgetRequestRepository } = require('./budget-request.repository')
const { db } = require('../../db/pool')

const VALID_STATUSES = ['pending', 'approved', 'rejected']
const MAX_AMOUNT = 1_000_000

const budgetRequestService = {
  async list(user, { status } = {}) {
    if (status && !VALID_STATUSES.includes(status)) {
      throw new HttpError(400, `status must be one of: ${VALID_STATUSES.join(', ')}`)
    }
    if (user.role === 'admin') {
      return budgetRequestRepository.findAll({ status })
    }
    return budgetRequestRepository.findByCashier(user.id, { status })
  },

  async create(user, { amount, reason, cashierNote }) {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new HttpError(400, 'Amount must be a positive number')
    }
    if (parsedAmount > MAX_AMOUNT) {
      throw new HttpError(400, `Amount cannot exceed ${MAX_AMOUNT.toLocaleString()}`)
    }
    const trimmedReason = String(reason || '').trim()
    if (!trimmedReason) {
      throw new HttpError(400, 'Reason is required')
    }
    if (trimmedReason.length > 500) {
      throw new HttpError(400, 'Reason cannot exceed 500 characters')
    }

    // Enforce limit: amount must not exceed remaining budget room
    const totalRevenue = await budgetRequestRepository.getCashierRevenue(user.id)
    const { totalApproved, totalPending } = await budgetRequestRepository.getCashierBudgetAllocated(user.id)
    const remaining = totalRevenue - totalApproved - totalPending

    if (totalRevenue === 0) {
      throw new HttpError(400, 'You have no recorded sales yet. Budget requests require at least some revenue.')
    }
    if (parsedAmount > remaining) {
      const fmt = (n) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const msg = remaining <= 0
        ? 'You have no remaining budget allowance. Your approved and pending requests already cover your total revenue.'
        : `Amount exceeds your remaining allowance of ${fmt(remaining)} (Revenue: ${fmt(totalRevenue)} − Already allocated: ${fmt(totalApproved + totalPending)})`
      throw new HttpError(400, msg)
    }

    const raw = await budgetRequestRepository.create({
      cashierId: user.id,
      amount: parsedAmount,
      reason: trimmedReason,
      cashierNote: cashierNote ? String(cashierNote).trim().slice(0, 500) : null,
    })

    // Return the full enriched record
    return budgetRequestRepository.findById(raw.id)
  },

  async review(requestId, reviewer, { status, adminNote }) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, "status must be 'approved' or 'rejected'")
    }

    const request = await budgetRequestRepository.findById(requestId)
    if (!request) throw new HttpError(404, 'Budget request not found')
    if (request.status !== 'pending') {
      throw new HttpError(409, `Request has already been ${request.status}`)
    }

    const updated = await budgetRequestRepository.review(requestId, {
      status,
      adminNote: adminNote ? String(adminNote).trim().slice(0, 500) : null,
      reviewedBy: reviewer.id,
    })

    if (!updated) throw new HttpError(409, 'Request was already reviewed by another admin')

    return budgetRequestRepository.findById(requestId)
  },

  async getMyLimit(user) {
    const totalRevenue = await budgetRequestRepository.getCashierRevenue(user.id)
    const { totalApproved, totalPending } = await budgetRequestRepository.getCashierBudgetAllocated(user.id)
    const remaining = Math.max(0, totalRevenue - totalApproved - totalPending)
    const used = totalApproved + totalPending
    return {
      totalRevenue,
      totalApproved,
      totalPending,
      remaining,
      utilizationPercent: totalRevenue > 0 ? Math.min(100, (used / totalRevenue) * 100) : 0,
    }
  },

  async getCashierStats() {
    return budgetRequestRepository.getAllCashierBudgetStats()
  },

  async getSummary() {
    const totals = await budgetRequestRepository.getTotals()

    // Fetch total revenue from orders
    const revenueResult = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0)::float AS total_revenue FROM orders`,
    )
    const totalRevenue = revenueResult.rows[0]?.total_revenue ?? 0
    const totalApproved = parseFloat(totals.total_approved_amount) || 0

    return {
      total: totals.total,
      pending: totals.pending,
      approved: totals.approved,
      rejected: totals.rejected,
      totalApprovedAmount: totalApproved,
      totalRevenue,
      netRevenue: totalRevenue - totalApproved,
    }
  },
}

module.exports = { budgetRequestService }
