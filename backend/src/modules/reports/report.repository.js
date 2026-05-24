const { db } = require('../../db/pool')

class ReportRepository {
  async getSalesData(intervalDays, bucketUnit, dateSymbols) {
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
      LEFT JOIN orders o ON DATE_TRUNC($2, o.created_at) = series_dates.date_bucket
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
      WHERE o.created_at >= NOW() - ($1 || ' days')::interval
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
      WHERE o.created_at >= NOW() - ($1 || ' days')::interval
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 5;
    `

    const [trendRes, categoryRes, itemsRes] = await Promise.all([
      db.query(trendQuery, [intervalDays, bucketUnit, dateSymbols]),
      db.query(categoryQuery, [intervalDays]),
      db.query(itemsQuery, [intervalDays])
    ])

    return {
      salesTrend: trendRes.rows,
      categoryDistribution: categoryRes.rows,
      topProducts: itemsRes.rows,
      summaryMetrics: {
        revenueGrowthPercentage: 12.5, 
        overallGrowthPercentage: 18.2
      }
    }
  }
}

module.exports = { reportRepository: new ReportRepository() }