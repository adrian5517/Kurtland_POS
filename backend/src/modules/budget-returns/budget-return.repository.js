const { db } = require('../../db/pool')

function toRow(row) {
  return {
    id: row.id,
    budgetRequestId: row.budget_request_id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name || null,
    cashierEmail: row.cashier_email || null,
    originalAmount: parseFloat(row.original_amount),
    amount: parseFloat(row.amount),
    reason: row.reason,
    status: row.status,
    adminNote: row.admin_note || null,
    reviewedBy: row.reviewed_by || null,
    reviewedByName: row.reviewed_by_name || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
  }
}

const BASE_SELECT = `
  SELECT
    br.id,
    br.budget_request_id,
    br.cashier_id,
    u.name  AS cashier_name,
    u.email AS cashier_email,
    bq.amount AS original_amount,
    br.amount,
    br.reason,
    br.status,
    br.admin_note,
    br.reviewed_by,
    rv.name AS reviewed_by_name,
    br.reviewed_at,
    br.created_at
  FROM budget_returns br
  JOIN users u ON u.id = br.cashier_id
  JOIN budget_requests bq ON bq.id = br.budget_request_id
  LEFT JOIN users rv ON rv.id = br.reviewed_by
`

const budgetReturnRepository = {
  async findAll({ status } = {}) {
    const params = []
    let where = ''
    if (status) {
      params.push(status)
      where = `WHERE br.status = $1`
    }
    const result = await db.query(`${BASE_SELECT} ${where} ORDER BY br.created_at DESC`, params)
    return result.rows.map(toRow)
  },

  async findByCashier(cashierId, { status } = {}) {
    const params = [cashierId]
    const conditions = ['br.cashier_id = $1']
    if (status) {
      params.push(status)
      conditions.push(`br.status = $${params.length}`)
    }
    const where = `WHERE ${conditions.join(' AND ')}`
    const result = await db.query(`${BASE_SELECT} ${where} ORDER BY br.created_at DESC`, params)
    return result.rows.map(toRow)
  },

  async findById(id) {
    const result = await db.query(`${BASE_SELECT} WHERE br.id = $1`, [id])
    return result.rows[0] ? toRow(result.rows[0]) : null
  },

  async create({ budgetRequestId, cashierId, amount, reason }) {
    const result = await db.query(
      `INSERT INTO budget_returns (budget_request_id, cashier_id, amount, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [budgetRequestId, cashierId, amount, reason],
    )
    return budgetReturnRepository.findById(result.rows[0].id)
  },

  async review(id, { status, adminNote, reviewedBy }) {
    const result = await db.query(
      `UPDATE budget_returns
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id, status, adminNote || null, reviewedBy],
    )
    return result.rows[0] || null
  },

  async getPendingReturnAmountForRequest(budgetRequestId) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::float AS pending_returns,
              COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float AS approved_returns
       FROM budget_returns WHERE budget_request_id = $1`,
      [budgetRequestId],
    )
    return {
      pendingReturns: parseFloat(result.rows[0]?.pending_returns ?? 0),
      approvedReturns: parseFloat(result.rows[0]?.approved_returns ?? 0),
    }
  },

  // Total approved returns for a cashier (reduces their "allocated" budget)
  async getApprovedReturnsByCashier(cashierId) {
    const result = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::float AS approved_returns
       FROM budget_returns
       WHERE cashier_id = $1 AND status = 'approved'`,
      [cashierId],
    )
    return parseFloat(result.rows[0]?.approved_returns ?? 0)
  },

  async getTotals() {
    const result = await db.query(`
      SELECT
        COUNT(*)::int                                                          AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int                       AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int                      AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int                      AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float    AS total_approved_amount
      FROM budget_returns
    `)
    return result.rows[0]
  },
}

module.exports = { budgetReturnRepository }
