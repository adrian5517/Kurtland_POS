'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, TrendingUp, DollarSign, ShoppingCart, Users } from 'lucide-react'

// Mock data
const SALES_DATA = [
  { date: 'Mon', sales: 4200, transactions: 24 },
  { date: 'Tue', sales: 3800, transactions: 22 },
  { date: 'Wed', sales: 5100, transactions: 31 },
  { date: 'Thu', sales: 4700, transactions: 28 },
  { date: 'Fri', sales: 6200, transactions: 38 },
  { date: 'Sat', sales: 7100, transactions: 45 },
  { date: 'Sun', sales: 5800, transactions: 36 },
]

const CATEGORY_DATA = [
  { name: 'Pizza', value: 8500 },
  { name: 'Burgers', value: 5200 },
  { name: 'Drinks', value: 3100 },
  { name: 'Desserts', value: 2800 },
  { name: 'Salads', value: 1900 },
]

const PRODUCT_DATA = [
  { name: 'Pepperoni Pizza', sales: 245, revenue: 73500 },
  { name: 'Coca Cola', sales: 412, revenue: 20600 },
  { name: 'Chicken Burger', sales: 187, revenue: 33660 },
  { name: 'Fresh OJ', sales: 156, revenue: 12480 },
  { name: 'Margherita Pizza', sales: 134, revenue: 33500 },
]

const COLORS = ['#b45309', '#dc2626', '#ea580c', '#d97706', '#f59e0b']

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState('week')

  const totalRevenue = SALES_DATA.reduce((sum, d) => sum + d.sales, 0)
  const totalTransactions = SALES_DATA.reduce((sum, d) => sum + d.transactions, 0)
  const avgTransaction = Math.round(totalRevenue / totalTransactions)
  const bestDay = SALES_DATA.reduce((max, d) => d.sales > max.sales ? d : max)

  return (
    <div className="w-full max-w-none space-y-6 md:space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Kurtland POS</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Sales Reports</h1>
          <p className="text-sm text-muted-foreground">Monitor revenue, transactions, and top-performing products.</p>
        </div>
        <Button className="w-full sm:w-auto gap-2 rounded-2xl bg-primary px-5 hover:bg-primary/90">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Time Range */}
      <div className="flex w-full flex-wrap gap-2">
        {['day', 'week', 'month', '3months'].map((range) => (
          <Button
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            onClick={() => setTimeRange(range)}
            className={`rounded-xl ${timeRange === range ? 'bg-primary text-primary-foreground' : 'border-primary/20'}`}
          >
            {range === 'day' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Last 3 Months'}
          </Button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">₱{totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-green-600 mt-1">+12.5% from last week</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{totalTransactions}</p>
            <p className="text-xs text-muted-foreground mt-1">Avg: ₱{avgTransaction.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Best Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">₱{bestDay.sales.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{bestDay.date}</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Growth Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">+18.2%</p>
            <p className="text-xs text-green-600 mt-1">Month-over-month</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sales Trend */}
        <Card className="border-primary/20 col-span-1 lg:col-span-2 rounded-3xl shadow-sm bg-card/95 overflow-hidden">
          <CardHeader>
            <CardTitle>Sales Trend</CardTitle>
            <CardDescription>Daily revenue and transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={SALES_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => `₱${value.toLocaleString()}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#b45309"
                  name="Revenue"
                  dot={{ fill: '#b45309' }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Category */}
        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95 overflow-hidden">
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
            <CardDescription>Distribution of revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={CATEGORY_DATA}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Transaction Count */}
        <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95 overflow-hidden">
          <CardHeader>
            <CardTitle>Daily Transactions</CardTitle>
            <CardDescription>Transaction volume trend</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={SALES_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => value}
                />
                <Bar dataKey="transactions" fill="#b45309" name="Transactions" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card className="border-primary/20 rounded-3xl shadow-sm bg-card/95 overflow-hidden">
        <CardHeader>
          <CardTitle>Top Selling Products</CardTitle>
          <CardDescription>Best performers this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {PRODUCT_DATA.map((product, idx) => (
              <div key={idx} className="flex items-center justify-between pb-4 border-b border-primary/10 last:border-0">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.sales} units sold</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">₱{product.revenue.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{((product.revenue / totalRevenue) * 100).toFixed(1)}% of total</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
