import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, UploadCloud, Plus
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'
import { formatCurrency, formatDate, formatMonth, getCategoryColor } from '../lib/utils'

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

function EmptyDashboard({ name }) {
  const navigate = useNavigate()
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Let's set up your financial dashboard</p>
      </div>

      {/* Primary CTA */}
      <div className="card p-10 flex flex-col items-center text-center gap-5 border-2 border-dashed border-primary-200 bg-primary-50/40">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center">
          <UploadCloud size={40} className="text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Upload your bank statement</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-md">
            Import your transactions automatically by uploading a bank statement (CSV, PDF, or Excel).
            Your dashboard will populate instantly with real charts and insights.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary btn-lg flex items-center gap-2"
          >
            <UploadCloud size={18} />
            Upload Statement
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className="btn-secondary btn-lg flex items-center gap-2"
          >
            <Plus size={16} />
            Add Manually
          </button>
        </div>
      </div>

      {/* Feature preview cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: TrendingUp, title: 'Income & Expense Trends', desc: 'Visual monthly charts showing where your money comes from and goes.', color: 'bg-green-100 text-green-600' },
          { icon: PiggyBank, title: 'Smart Categorization', desc: 'Transactions are automatically sorted into Food, Transport, Shopping, and more.', color: 'bg-purple-100 text-purple-600' },
          { icon: Wallet, title: 'Savings Analytics', desc: 'Track your savings rate and net balance at a glance every month.', color: 'bg-blue-100 text-blue-600' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="card p-5 space-y-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon size={20} />
            </div>
            <p className="font-semibold text-gray-800">{title}</p>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary]       = useState(null)
  const [trends, setTrends]         = useState([])
  const [recentTx, setRecentTx]     = useState([])
  const [categoryData, setCategoryData] = useState([])
  const [hasData, setHasData]       = useState(null) // null = loading
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [summaryRes, trendsRes, txRes, catRes] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/monthly-trends?months=6'),
          api.get('/transactions?per_page=5&sort_by=date&sort_dir=desc'),
          api.get('/analytics/category-breakdown'),
        ])

        const s = summaryRes.data
        const hasTx = (txRes.data?.total ?? 0) > 0

        setHasData(hasTx)
        if (hasTx) {
          setSummary(s)
          if (trendsRes.data?.length) setTrends(trendsRes.data)
          if (txRes.data?.data?.length) setRecentTx(txRes.data.data)
          if (catRes.data?.length) setCategoryData(catRes.data.slice(0, 5))
        }
      } catch {
        setHasData(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8" />
      </div>
    )
  }

  if (!hasData) {
    return <EmptyDashboard name={user?.name} />
  }

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
        <Link
          to="/upload"
          className="btn-secondary btn-sm flex items-center gap-1.5"
        >
          <UploadCloud size={14} />
          Upload Statement
        </Link>
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
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tickFormatter={formatMonth} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income"  stroke="#16a34a" strokeWidth={2} fill="url(#incomeGrad)"  name="income" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" name="expense" />
              <Area type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} fill="none"              name="savings" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Top Expenses</h2>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="total"
                  nameKey="category"
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  paddingAngle={3}
                >
                  {categoryData.map((entry) => (
                    <Cell key={entry.category} fill={getCategoryColor(entry.category)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
              No expense data yet
            </div>
          )}
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
        {recentTx.length === 0 ? (
          <div className="px-6 pb-8 text-center text-gray-400 text-sm">No transactions yet.</div>
        ) : (
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
        )}
        <div className="px-6 py-4 border-t border-gray-50 flex gap-2">
          <Link to="/upload" className="btn-secondary btn-sm flex items-center gap-1.5">
            <UploadCloud size={14} />
            Upload Statement
          </Link>
          <Link to="/transactions" className="btn-secondary btn-sm flex items-center gap-1.5">
            <Plus size={14} />
            Add Manually
          </Link>
        </div>
      </div>
    </div>
  )
}
