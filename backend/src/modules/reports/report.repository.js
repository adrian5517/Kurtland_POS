const { db } = require('../../db/pool')

class ReportRepository {
  async getSalesData(intervalDays, bucketUnit, dateSymbols, cashierId = null) {
    // Build parameterised cashier filter for the trend query (uses 4 params)
    const trendParams = [intervalDays, bucketUnit, dateSymbols]
    const trendCashierClause = cashierId ? ' AND o.cashier_id = $4' : ''
    if (cashierId) trendParams.push(cashierId)

    // Category/items queries only use 1 base param + optional cashier
    const filterParams = cashierId ? [intervalDays, cashierId] : [intervalDays]
    const filterCashierClause = cashierId ? ' AND o.cashier_id = $2' : ''

    const trendQuery = `
      SELECT 
        TO_CHAR(series_dates.date_bucket, $3) as date,
        COALESCE(SUM(oi.subtotal), 0)::float as sales,
        COUNT(DISTINCT o.id)::int as transactions
      FROM (
        SELECT generate_series(
          DATE_TRUNC($2, NOW() - ($1 || ' days')::interval), 
          DATE_TRUNC($2, NOW()), 
          ('1 ' || $2)::interval
        ) as date_bucket
      ) series_dates
      LEFT JOIN orders o ON DATE_TRUNC($2, o.created_at) = series_dates.date_bucket${trendCashierClause}
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY series_dates.date_bucket
      ORDER BY series_dates.date_bucket ASC;
    `

    const categoryQuery = `
      SELECT 
        COALESCE(p.category, 'Uncategorized') as name,
        SUM(oi.subtotal)::float as value
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - ($1 || ' days')::interval${filterCashierClause}
      GROUP BY p.category
      ORDER BY value DESC;
    `

    const itemsQuery = `
      SELECT 
        p.name,
        SUM(oi.quantity)::int as sales,
        SUM(oi.subtotal)::float as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - ($1 || ' days')::interval${filterCashierClause}
      GROUP BY p.id, p.name
      ORDER BY sales DESC, revenue DESC
      LIMIT 500;
    `

    // Growth: compare the current period against the previous equal-length
    // period. e.g. range=week → last 7 days vs the 7 days before that.
    // $1 = intervalDays (text). Reuses the same optional cashier filter.
    const growthQuery = `
      SELECT
        COALESCE(SUM(oi.subtotal) FILTER (
          WHERE o.created_at >= NOW() - ($1 || ' days')::interval), 0)::float AS current_revenue,
        COALESCE(SUM(oi.subtotal) FILTER (
          WHERE o.created_at >= NOW() - (($1::int * 2) || ' days')::interval
            AND o.created_at <  NOW() - ($1 || ' days')::interval), 0)::float AS previous_revenue,
        COUNT(DISTINCT o.id) FILTER (
          WHERE o.created_at >= NOW() - ($1 || ' days')::interval)::int AS current_tx,
        COUNT(DISTINCT o.id) FILTER (
          WHERE o.created_at >= NOW() - (($1::int * 2) || ' days')::interval
            AND o.created_at <  NOW() - ($1 || ' days')::interval)::int AS previous_tx
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.created_at >= NOW() - (($1::int * 2) || ' days')::interval${filterCashierClause};
    `

    const [trendRes, categoryRes, itemsRes, growthRes] = await Promise.all([
      db.query(trendQuery, trendParams),
      db.query(categoryQuery, filterParams),
      db.query(itemsQuery, filterParams),
      db.query(growthQuery, filterParams),
    ])

    // Percentage change with safe handling of a zero baseline.
    const pctChange = (current, previous) => {
      const cur = Number(current) || 0
      const prev = Number(previous) || 0
      if (prev === 0) return cur > 0 ? 100 : 0
      return Number((((cur - prev) / prev) * 100).toFixed(1))
    }

    const g = growthRes.rows[0] || {}
    const revenueGrowthPercentage = pctChange(g.current_revenue, g.previous_revenue)
    const transactionGrowthPercentage = pctChange(g.current_tx, g.previous_tx)
    // "Overall" = blended view of value (revenue) and volume (transactions).
    const overallGrowthPercentage = Number(
      ((revenueGrowthPercentage + transactionGrowthPercentage) / 2).toFixed(1),
    )

    return {
      salesTrend: trendRes.rows,
      categoryDistribution: categoryRes.rows,
      topProducts: itemsRes.rows,
      summaryMetrics: {
        revenueGrowthPercentage,
        overallGrowthPercentage,
      },
    }
  }

  // Per-day sales breakdown (grouped by local PH date) with optional date
  // range and cashier filter. Defaults to the last 90 days when no range given.
  async getDailySales({ cashierId = null, from = null, to = null } = {}) {
    const params = []
    const conditions = []

    if (from) {
      params.push(from)
      conditions.push(`(o.created_at AT TIME ZONE 'Asia/Manila') >= $${params.length}::date`)
    } else {
      conditions.push(`o.created_at >= NOW() - INTERVAL '90 days'`)
    }
    if (to) {
      params.push(to)
      conditions.push(`(o.created_at AT TIME ZONE 'Asia/Manila') < ($${params.length}::date + INTERVAL '1 day')`)
    }
    if (cashierId) {
      params.push(cashierId)
      conditions.push(`o.cashier_id = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await db.query(
      `SELECT
         TO_CHAR(DATE(o.created_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD') AS day,
         COUNT(DISTINCT o.id)::int                                   AS transactions,
         COALESCE(SUM(oi.quantity), 0)::int                          AS items_sold,
         COALESCE(SUM(oi.subtotal), 0)::float                        AS revenue,
         COALESCE(SUM(oi.subtotal) - SUM(p.price * oi.quantity), 0)::float AS profit
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       ${where}
       GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Manila')
       ORDER BY day DESC`,
      params,
    )
    return result.rows
  }

  async getCashierPerformance(intervalDays) {
    // profit = revenue − cost of goods sold. Cost uses the product's current
    // cost (products.price), since order_items doesn't snapshot cost at sale.
    // sales_margin = profit / revenue × 100 (true margin on actual sales).
    const result = await db.query(
      `SELECT
         o.cashier_id,
         o.cashier_email,
         COALESCE(SUM(oi.subtotal), 0)::float                        AS revenue,
         COUNT(DISTINCT o.id)::int                                   AS transactions,
         COALESCE(AVG(NULLIF(oi.subtotal, 0)), 0)::float             AS avg_order_value,
         COALESCE(SUM(oi.subtotal) - SUM(p.price * oi.quantity), 0)::float AS profit,
         CASE
           WHEN COALESCE(SUM(oi.subtotal), 0) > 0
           THEN ((SUM(oi.subtotal) - SUM(p.price * oi.quantity)) / SUM(oi.subtotal) * 100)
           ELSE 0
         END::float                                                  AS sales_margin
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.created_at >= NOW() - ($1 || ' days')::interval
       GROUP BY o.cashier_id, o.cashier_email
       ORDER BY revenue DESC`,
      [intervalDays]
    )
    return result.rows
  }
}

module.exports = { reportRepository: new ReportRepository() }