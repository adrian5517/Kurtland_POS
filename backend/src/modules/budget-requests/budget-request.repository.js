const { db } = require('../../db/pool')

function toRow(row) {
  return {
    id: row.id,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name || null,
    cashierEmail: row.cashier_email || null,
    amount: parseFloat(row.amount),
    reason: row.reason,
    cashierNote: row.cashier_note || null,
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
    br.cashier_id,
    u.name  AS cashier_name,
    u.email AS cashier_email,
    br.amount,
    br.reason,
    br.cashier_note,
    br.status,
    br.admin_note,
    br.reviewed_by,
    rv.name AS reviewed_by_name,
    br.reviewed_at,
    br.created_at
  FROM budget_requests br
  JOIN users u ON u.id = br.cashier_id
  LEFT JOIN users rv ON rv.id = br.reviewed_by
`

const budgetRequestRepository = {
  async findAll({ status } = {}) {
    const conditions = []
    const params = []
    if (status) {
      params.push(status)
      conditions.push(`br.status = $${params.length}`)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = await db.query(`${BASE_SELECT} ${where} ORDER BY br.created_at DESC`)
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

  async create({ cashierId, amount, reason, cashierNote }) {
    const result = await db.query(
      `INSERT INTO budget_requests (cashier_id, amount, reason, cashier_note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, cashier_id, amount, reason, cashier_note, status, admin_note, reviewed_by, reviewed_at, created_at`,
      [cashierId, amount, reason, cashierNote || null],
    )
    return result.rows[0]
  },

  async review(id, { status, adminNote, reviewedBy }) {
    const result = await db.query(
      `UPDATE budget_requests
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [id, status, adminNote || null, reviewedBy],
    )
    return result.rows[0] || null
  },

  async getTotals() {
    const result = await db.query(`
      SELECT
        COUNT(*)::int                                                         AS total,
        COUNT(*) FILTER (WHERE status = 'pending')::int                      AS pending,
        COUNT(*) FILTER (WHERE status = 'approved')::int                     AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int                     AS rejected,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float   AS total_approved_amount
      FROM budget_requests
    `)
    return result.rows[0]
  },

  async getCashierRevenue(cashierId) {
    const result = await db.query(
      `SELECT COALESCE(SUM(total_amount), 0)::float AS total_revenue
       FROM orders WHERE cashier_id = $1`,
      [cashierId],
    )
    return parseFloat(result.rows[0]?.total_revenue ?? 0)
  },

  async getCashierBudgetAllocated(cashierId) {
    const result = await db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float AS total_approved,
         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'),  0)::float AS total_pending
       FROM budget_requests WHERE cashier_id = $1`,
      [cashierId],
    )
    // Subtract approved returns so returned budget frees up allowance
    const retResult = await db.query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'approved'), 0)::float AS approved_returns
       FROM budget_returns WHERE cashier_id = $1`,
      [cashierId],
    )
    const approvedReturns = parseFloat(retResult.rows[0]?.approved_returns ?? 0)
    return {
      totalApproved: Math.max(0, parseFloat(result.rows[0]?.total_approved ?? 0) - approvedReturns),
      totalPending:  parseFloat(result.rows[0]?.total_pending  ?? 0),
    }
  },

  async getAllCashierBudgetStats() {
    const result = await db.query(`
      SELECT
        u.id,
        u.email,
        u.name,
        COALESCE(SUM(DISTINCT o.total_amount), 0)::float                                AS total_revenue,
        COALESCE(SUM(br.amount) FILTER (WHERE br.status = 'approved'), 0)::float        AS total_approved,
        COALESCE(SUM(br.amount) FILTER (WHERE br.status = 'pending'),  0)::float        AS total_pending,
        COALESCE(SUM(ret.amount) FILTER (WHERE ret.status = 'approved'), 0)::float      AS approved_returns
      FROM users u
      LEFT JOIN orders o ON o.cashier_id = u.id
      LEFT JOIN budget_requests br ON br.cashier_id = u.id
      LEFT JOIN budget_returns ret ON ret.cashier_id = u.id
      WHERE u.role = 'cashier' AND u.is_active = true
      GROUP BY u.id, u.email, u.name
      ORDER BY total_revenue DESC
    `)
    return result.rows.map((r) => {
      const revenue         = parseFloat(r.total_revenue)
      const approvedGross   = parseFloat(r.total_approved)
      const approvedReturns = parseFloat(r.approved_returns)
      const approved        = Math.max(0, approvedGross - approvedReturns)
      const pending         = parseFloat(r.total_pending)
      return {
        cashierId:      r.id,
        cashierEmail:   r.email,
        cashierName:    r.name,
        totalRevenue:   revenue,
        totalApproved:  approved,
        totalPending:   pending,
        approvedReturns: approvedReturns,
        remaining: Math.max(0, revenue - approved - pending),
      }
    })
  },
}

module.exports = { budgetRequestRepository }
