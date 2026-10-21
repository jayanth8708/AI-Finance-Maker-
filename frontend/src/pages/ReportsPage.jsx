import { useState, useEffect } from 'react'
import { Download, Printer, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import api from '../lib/api'
import { formatCurrency, formatMonth, formatDate, downloadFile, transactionsToCSV } from '../lib/utils'
import { MOCK_SUMMARY, MOCK_MONTHLY_TRENDS, MOCK_TRANSACTIONS } from '../data/mockData'

export default function ReportsPage() {
  const [summary, setSummary] = useState(MOCK_SUMMARY)
  const [trends, setTrends] = useState(MOCK_MONTHLY_TRENDS)
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS)
  const [usingMock, setUsingMock] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, tx] = await Promise.all([
          api.get('/analytics/summary'),
          api.get('/analytics/monthly-trends?months=6'),
          api.get('/transactions?per_page=100&sort_by=date&sort_dir=desc'),
        ])
        if (s.data) { setSummary(s.data); setUsingMock(false) }
        if (t.data?.length) setTrends(t.data)
        if (tx.data?.data?.length) setTransactions(tx.data.data)
      } catch { /* fall back */ }
    }
    load()
  }, [])

  const handleExportCSV = () => {
    const csv = transactionsToCSV(transactions)
    downloadFile(csv, `financial-report-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const handlePrint = () => window.print()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-gray-500 text-sm">Comprehensive view of your financial health</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={handleExportCSV} className="btn-secondary btn-sm">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={handlePrint} className="btn-secondary btn-sm">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {usingMock && <div className="alert-info text-xs print:hidden">Showing demo report data.</div>}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Income', value: summary.total_income, icon: TrendingUp, color: 'text-primary-600 bg-primary-100' },
          { label: 'Total Expenses', value: summary.total_expense, icon: TrendingDown, color: 'text-red-500 bg-red-100' },
          { label: 'Net Savings', value: summary.net_savings, icon: PiggyBank, color: 'text-blue-600 bg-blue-100' },
        ].map((item) => (
          <div key={item.label} className="card p-5 text-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 ${item.color}`}>
              <item.icon size={18} />
            </div>
            <p className="text-sm font-medium text-gray-500">{item.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{formatCurrency(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Monthly summary table */}
      <div className="card overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-800">Monthly Summary</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Income</th>
              <th className="text-right">Expenses</th>
              <th className="text-right">Savings</th>
              <th className="text-right">Savings Rate</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((row) => (
              <tr key={row.month}>
                <td className="font-medium">{formatMonth(row.month)}</td>
                <td className="text-right text-primary-600 font-semibold">{formatCurrency(row.income)}</td>
                <td className="text-right text-red-500 font-semibold">{formatCurrency(row.expense)}</td>
                <td className="text-right text-blue-600 font-semibold">{formatCurrency(row.savings)}</td>
                <td className="text-right text-gray-600 text-xs">
                  {row.income > 0 ? `${Math.round((row.savings / row.income) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right text-primary-600">{formatCurrency(trends.reduce((s, r) => s + r.income, 0))}</td>
              <td className="px-4 py-3 text-right text-red-500">{formatCurrency(trends.reduce((s, r) => s + r.expense, 0))}</td>
              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(trends.reduce((s, r) => s + r.savings, 0))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Transactions export table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Transaction Ledger ({transactions.length} records)
          </h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Type</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 20).map((tx) => (
              <tr key={tx.id}>
                <td className="text-gray-500 text-xs">{formatDate(tx.date)}</td>
                <td className="font-medium text-gray-800">{tx.title}</td>
                <td><span className="badge-gray">{tx.category}</span></td>
                <td>
                  <span className={tx.type === 'income' ? 'badge-green' : 'badge-red'}>
                    {tx.type}
                  </span>
                </td>
                <td className={`text-right font-semibold ${tx.type === 'income' ? 'text-primary-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length > 20 && (
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
            Showing 20 of {transactions.length}. Export CSV for complete data.
          </div>
        )}
      </div>
    </div>
  )
}
