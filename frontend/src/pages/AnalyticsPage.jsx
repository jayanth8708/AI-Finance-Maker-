import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts'
import api from '../lib/api'
import { formatCurrency, formatMonth, getCategoryColor } from '../lib/utils'
import { MOCK_SUMMARY, MOCK_MONTHLY_TRENDS, MOCK_CATEGORY_BREAKDOWN } from '../data/mockData'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-sm shadow-card-md">
      <p className="font-semibold text-gray-700 mb-1">{formatMonth(label) || label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(MOCK_SUMMARY)
  const [trends, setTrends] = useState(MOCK_MONTHLY_TRENDS)
  const [categories, setCategories] = useState(MOCK_CATEGORY_BREAKDOWN)
  const [usingMock, setUsingMock] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, c] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/monthly-trends?months=6'),
          api.get('/analytics/category-breakdown'),
        ])
        if (s.data) { setSummary(s.data); setUsingMock(false) }
        if (t.data?.length) setTrends(t.data)
        if (c.data?.length) setCategories(c.data)
      } catch { /* fall back to mock */ }
    }
    load()
  }, [])

  const savingsRate = summary.total_income > 0
    ? Math.round((summary.net_savings / summary.total_income) * 100) : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm">Understand your financial patterns</p>
        </div>
        {usingMock && <span className="badge-yellow text-xs">Demo data</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: summary.total_income, color: 'text-primary-600' },
          { label: 'Total Expenses', value: summary.total_expense, color: 'text-red-500' },
          { label: 'Net Savings', value: summary.net_savings, color: 'text-blue-600' },
          { label: 'Savings Rate', value: null, rate: savingsRate, color: 'text-purple-600' },
        ].map((item) => (
          <div key={item.label} className="card p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>
              {item.value != null ? formatCurrency(item.value, true) : `${item.rate}%`}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly Income vs Expense bar chart */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Income vs Expenses (Monthly)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend formatter={(v) => <span className="text-xs text-gray-600 capitalize">{v}</span>} />
            <Bar dataKey="income" name="income" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Savings trend */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Savings Trend</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="savings" name="savings" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Expense by Category</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categories} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
                {categories.map((entry) => (
                  <Cell key={entry.category} fill={getCategoryColor(entry.category)} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {categories.map((cat) => {
              const totalExpense = categories.reduce((sum, c) => sum + c.total, 0)
              const pct = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{cat.category}</span>
                    <div className="flex gap-3">
                      <span className="text-gray-500 text-xs">{pct}%</span>
                      <span className="font-semibold text-gray-800">{formatCurrency(cat.total)}</span>
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: getCategoryColor(cat.category) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
