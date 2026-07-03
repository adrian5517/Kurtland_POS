const { db } = require('../../db/pool')

class ReportRepository {
  async getSalesData(intervalDays, bucketUnit, dateSymbols, cashierId = null) {
    // intervalDays / bucketUnit / dateSymbols come from a fixed whitelist in the
    // service (_getRangeConfig), NOT user input, so they are inlined safely. The
    // ONLY bind parameter is the cashier id ($1); this avoids Postgres being
    // unable to infer the type of an unreferenced parameter.
    const params = cashierId ? [cashierId] : []
    const cashierClause = cashierId ? ' AND o.cashier_id = $1' : ''

    // All time math is in Philippine local time. "Today" (hour bucket) = the
    // calendar day from PH midnight; other ranges = the last N days (PH).
    const nowLocal = `(NOW() AT TIME ZONE 'Asia/Manila')`
    const createdAtLocal = `(o.created_at AT TIME ZONE 'Asia/Manila')`

    // Trend series lower bound (bucket-aligned) and per-section window start.
    const trendLower = bucketUnit === 'hour'
      ? `DATE_TRUNC('day', ${nowLocal})`
      : `DATE_TRUNC('${bucketUnit}', ${nowLocal} - INTERVAL '${intervalDays} days')`
    const periodStart = bucketUnit === 'hour'
      ? `DATE_TRUNC('day', ${nowLocal})`
      : `(${nowLocal} - INTERVAL '${intervalDays} days')`
    const periodLen = bucketUnit === 'hour' ? `INTERVAL '1 day'` : `INTERVAL '${intervalDays} days'`

    const trendQuery = `
      SELECT
        TO_CHAR(series_dates.date_bucket, '${dateSymbols}') as date,
        COALESCE(SUM(oi.subtotal), 0)::float as sales,
        COUNT(DISTINCT o.id)::int as transactions
      FROM (
        SELECT generate_series(
          ${trendLower},
          DATE_TRUNC('${bucketUnit}', ${nowLocal}),
          INTERVAL '1 ${bucketUnit}'
        ) as date_bucket
      ) series_dates
      LEFT JOIN orders o
        ON DATE_TRUNC('${bucketUnit}', ${createdAtLocal}) = series_dates.date_bucket${cashierClause}
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
      WHERE ${createdAtLocal} >= ${periodStart}${cashierClause}
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
      WHERE ${createdAtLocal} >= ${periodStart}${cashierClause}
      GROUP BY p.id, p.name
      ORDER BY sales DESC, revenue DESC
      LIMIT 500;
    `

    // Growth: current period vs the previous equal-length period, in PH time.
    // Today → today so far vs all of yesterday; week → last 7d vs prior 7d, etc.
    const growthQuery = `
      SELECT
        COALESCE(SUM(oi.subtotal) FILTER (
          WHERE ${createdAtLocal} >= ${periodStart}), 0)::float AS current_revenue,
        COALESCE(SUM(oi.subtotal) FILTER (
          WHERE ${createdAtLocal} >= ${periodStart} - ${periodLen}
            AND ${createdAtLocal} <  ${periodStart}), 0)::float AS previous_revenue,
        COUNT(DISTINCT o.id) FILTER (
          WHERE ${createdAtLocal} >= ${periodStart})::int AS current_tx,
        COUNT(DISTINCT o.id) FILTER (
          WHERE ${createdAtLocal} >= ${periodStart} - ${periodLen}
            AND ${createdAtLocal} <  ${periodStart})::int AS previous_tx
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE ${createdAtLocal} >= ${periodStart} - ${periodLen}${cashierClause};
    `

    const [trendRes, categoryRes, itemsRes, growthRes] = await Promise.all([
      db.query(trendQuery, params),
      db.query(categoryQuery, params),
      db.query(itemsQuery, params),
      db.query(growthQuery, params),
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
         COALESCE(SUM(oi.subtotal) - SUM(COALESCE(oi.unit_cost, p.price) * oi.quantity), 0)::float AS profit
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

  async getCashierPerformance(intervalDays, bucketUnit) {
    // Use the SAME PH-time window as the Overview so both tabs agree: "Today"
    // = the PH calendar day from midnight; other ranges = the last N days (PH).
    // intervalDays / bucketUnit are whitelisted config values, inlined safely.
    const nowLocal = `(NOW() AT TIME ZONE 'Asia/Manila')`
    const createdAtLocal = `(o.created_at AT TIME ZONE 'Asia/Manila')`
    const periodStart = bucketUnit === 'hour'
      ? `DATE_TRUNC('day', ${nowLocal})`
      : `(${nowLocal} - INTERVAL '${intervalDays} days')`

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
         COALESCE(SUM(oi.subtotal) - SUM(COALESCE(oi.unit_cost, p.price) * oi.quantity), 0)::float AS profit,
         CASE
           WHEN COALESCE(SUM(oi.subtotal), 0) > 0
           THEN ((SUM(oi.subtotal) - SUM(COALESCE(oi.unit_cost, p.price) * oi.quantity)) / SUM(oi.subtotal) * 100)
           ELSE 0
         END::float                                                  AS sales_margin
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE ${createdAtLocal} >= ${periodStart}
       GROUP BY o.cashier_id, o.cashier_email
       ORDER BY revenue DESC`
    )
    return result.rows
  }
}

module.exports = { reportRepository: new ReportRepository() }