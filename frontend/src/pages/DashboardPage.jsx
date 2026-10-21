import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, Plus
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { formatCurrency, formatDate, formatMonth, getCategoryColor } from '../lib/utils'
import { MOCK_SUMMARY, MOCK_MONTHLY_TRENDS, MOCK_TRANSACTIONS, MOCK_CATEGORY_BREAKDOWN } from '../data/mockData'

function StatCard({ label, value, delta, icon: Icon, color, positive }) {
  return (
    <div className="stat-card animate-slide-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {delta != null && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${positive ? 'text-primary-600' : 'text-red-500'}`}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          <span>{delta}</span>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card p-3 text-sm shadow-card-md">
      <p className="font-semibold text-gray-700 mb-1">{formatMonth(label)}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="flex justify-between gap-4">
          <span className="capitalize">{p.name}</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(MOCK_SUMMARY)
  const [trends, setTrends] = useState(MOCK_MONTHLY_TRENDS)
  const [recentTx, setRecentTx] = useState(MOCK_TRANSACTIONS.slice(0, 5))
  const [categoryData, setCategoryData] = useState(MOCK_CATEGORY_BREAKDOWN.slice(0, 5))
  const [usingMock, setUsingMock] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, trendsRes, txRes, catRes] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/monthly-trends?months=6'),
          api.get('/transactions?per_page=5&sort_by=date&sort_dir=desc'),
          api.get('/analytics/category-breakdown'),
        ])
        if (summaryRes.data) { setSummary(summaryRes.data); setUsingMock(false) }
        if (trendsRes.data?.length) setTrends(trendsRes.data)
        if (txRes.data?.data?.length) setRecentTx(txRes.data.data)
        if (catRes.data?.length) setCategoryData(catRes.data.slice(0, 5))
      } catch {
        // Fall back to mock data silently
      }
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your financial overview</p>
        </div>
        {usingMock && (
          <span className="badge-yellow text-xs">Demo data — add transactions to see your data</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Income"
          value={formatCurrency(summary.total_income, true)}
          icon={TrendingUp}
          color="bg-primary-100 text-primary-600"
          positive
          delta={`${formatCurrency(summary.month_income)} this month`}
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(summary.total_expense, true)}
          icon={TrendingDown}
          color="bg-red-100 text-red-500"
          positive={false}
          delta={`${formatCurrency(summary.month_expense)} this month`}
        />
        <StatCard
          label="Net Savings"
          value={formatCurrency(summary.net_savings, true)}
          icon={PiggyBank}
          color="bg-blue-100 text-blue-600"
          positive
          delta={`${formatCurrency(summary.month_savings)} this month`}
        />
        <StatCard
          label="Savings Rate"
          value={`${summary.total_income > 0 ? Math.round((summary.net_savings / summary.total_income) * 100) : 0}%`}
          icon={Wallet}
          color="bg-purple-100 text-purple-600"
          positive
          delta="Of total income saved"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trends */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Monthly Trends</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} fill="url(#incomeGrad)" name="income" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="expense" />
              <Area type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} fill="none" name="savings" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Top Expenses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
              >
                {categoryData.map((entry) => (
                  <Cell key={entry.category} fill={getCategoryColor(entry.category)} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="card">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-800">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm text-primary-600 font-medium hover:text-primary-700">
            View all
          </Link>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Category</th>
              <th>Date</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentTx.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                      tx.type === 'income' ? 'bg-primary-100 text-primary-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {tx.type === 'income' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    </div>
                    <span className="font-medium text-gray-800">{tx.title}</span>
                  </div>
                </td>
                <td><span className="badge-gray">{tx.category}</span></td>
                <td className="text-gray-500 text-xs">{formatDate(tx.date)}</td>
                <td className="text-right">
                  <span className={`font-semibold ${tx.type === 'income' ? 'text-primary-600' : 'text-red-500'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 border-t border-gray-50">
          <Link to="/transactions" className="btn-secondary btn-sm">
            <Plus size={14} />
            Add transaction
          </Link>
        </div>
      </div>

      {/* AI Recommendations */}
      <div className="card p-6 border-l-4 border-primary-500">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <TrendingUp size={15} className="text-primary-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-1">AI Insight (Simulated)</p>
            <p className="text-sm font-semibold text-gray-800">Your savings rate is healthy at {summary.total_income > 0 ? Math.round((summary.net_savings / summary.total_income) * 100) : 46}%</p>
            <p className="text-sm text-gray-500 mt-1">
              Consider investing your monthly surplus into index funds or SIPs to grow your wealth over time.
              Your food spending is 15% below target — great discipline!
            </p>
            <Link to="/advisor" className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary-600 font-medium hover:text-primary-700">
              View full analysis <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
