const { HttpError } = require('../../utils/http-error')
const { budgetReturnRepository } = require('./budget-return.repository')
const { budgetRequestRepository } = require('../budget-requests/budget-request.repository')

const MAX_RETURN_AMOUNT = 1_000_000

const budgetReturnService = {
  async list(user, { status } = {}) {
    if (user.role === 'admin') {
      return budgetReturnRepository.findAll({ status })
    }
    return budgetReturnRepository.findByCashier(user.id, { status })
  },

  async create(user, { budgetRequestId, amount, reason }) {
    const parsedId = parseInt(budgetRequestId, 10)
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new HttpError(400, 'Invalid budget request ID')
    }

    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new HttpError(400, 'Amount must be a positive number')
    }
    if (parsedAmount > MAX_RETURN_AMOUNT) {
      throw new HttpError(400, `Return amount cannot exceed ${MAX_RETURN_AMOUNT.toLocaleString()}`)
    }

    const trimmedReason = String(reason || '').trim()
    if (!trimmedReason) {
      throw new HttpError(400, 'Reason is required')
    }
    if (trimmedReason.length > 500) {
      throw new HttpError(400, 'Reason cannot exceed 500 characters')
    }

    // Verify the budget request exists, belongs to cashier, and is approved
    const budgetRequest = await budgetRequestRepository.findById(parsedId)
    if (!budgetRequest) {
      throw new HttpError(404, 'Budget request not found')
    }
    if (budgetRequest.cashierId !== user.id) {
      throw new HttpError(403, 'You can only return your own approved budget requests')
    }
    if (budgetRequest.status !== 'approved') {
      throw new HttpError(400, 'You can only return budget from approved requests')
    }

    // Return amount must not exceed the original approved amount minus already-returned amounts
    const { pendingReturns, approvedReturns } = await budgetReturnRepository.getPendingReturnAmountForRequest(parsedId)
    const alreadyReturned = pendingReturns + approvedReturns
    const maxReturn = budgetRequest.amount - alreadyReturned

    if (maxReturn <= 0) {
      throw new HttpError(400, 'This budget request has already been fully returned')
    }
    if (parsedAmount > maxReturn) {
      const fmt = (n) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      throw new HttpError(400, `Return amount cannot exceed ${fmt(maxReturn)} (the remaining returnable amount)`)
    }

    return budgetReturnRepository.create({
      budgetRequestId: parsedId,
      cashierId: user.id,
      amount: parsedAmount,
      reason: trimmedReason,
    })
  },

  async review(returnId, reviewer, { status, adminNote }) {
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, "status must be 'approved' or 'rejected'")
    }

    const ret = await budgetReturnRepository.findById(returnId)
    if (!ret) throw new HttpError(404, 'Budget return not found')
    if (ret.status !== 'pending') {
      throw new HttpError(409, `Return has already been ${ret.status}`)
    }

    const updated = await budgetReturnRepository.review(returnId, {
      status,
      adminNote: adminNote ? String(adminNote).trim().slice(0, 500) : null,
      reviewedBy: reviewer.id,
    })

    if (!updated) throw new HttpError(409, 'Return was already reviewed by another admin')

    return budgetReturnRepository.findById(returnId)
  },

  async getTotals() {
    return budgetReturnRepository.getTotals()
  },
}

module.exports = { budgetReturnService }
