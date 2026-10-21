import { useState, useEffect, useCallback } from 'react'
import {
  Search, Filter, Plus, Pencil, Trash2,
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import api from '../lib/api'
import { formatCurrency, formatDate, downloadFile, transactionsToCSV } from '../lib/utils'
import { MOCK_TRANSACTIONS, CATEGORIES } from '../data/mockData'

const EMPTY_FORM = {
  title: '', amount: '', type: 'expense', category: '', description: '', date: ''
}

function TransactionModal({ tx, onClose, onSave }) {
  const [form, setForm] = useState(tx ? {
    title: tx.title, amount: String(tx.amount), type: tx.type,
    category: tx.category, description: tx.description || '', date: tx.date
  } : { ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title || !form.amount || !form.category || !form.date) {
      setError('Please fill in all required fields.'); return
    }
    setLoading(true); setError('')
    try {
      await onSave({
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        category: form.category,
        description: form.description || null,
        date: form.date,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">{tx ? 'Edit transaction' : 'Add transaction'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && <div className="alert-error mb-4 text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title *</label>
            <input name="title" value={form.title} onChange={handleChange} className="input" placeholder="e.g. Grocery Shopping" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount (₹) *</label>
              <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={handleChange} className="input" placeholder="0.00" required />
            </div>
            <div>
              <label className="label">Type *</label>
              <select name="type" value={form.type} onChange={handleChange} className="input">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category *</label>
              <select name="category" value={form.category} onChange={handleChange} className="input" required>
                <option value="">Select...</option>
                {CATEGORIES[form.type].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input name="date" type="date" value={form.date} onChange={handleChange} className="input" required />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" value={form.description} onChange={handleChange} className="input" placeholder="Optional notes" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="spinner" /> : tx ? 'Save changes' : 'Add transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [loading, setLoading] = useState(false)
  const [usingMock, setUsingMock] = useState(false)
  const [modal, setModal] = useState(null) // null | 'add' | transaction object
  const [deleteId, setDeleteId] = useState(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: 15, sort_by: sortBy, sort_dir: sortDir })
      if (search) params.set('search', search)
      if (typeFilter) params.set('type', typeFilter)
      const { data } = await api.get(`/transactions?${params}`)
      if (data.total === 0 && !search && !typeFilter) {
        // No real data, show mock
        setTransactions(MOCK_TRANSACTIONS.slice(0, 15))
        setTotal(MOCK_TRANSACTIONS.length)
        setPages(Math.ceil(MOCK_TRANSACTIONS.length / 15))
        setUsingMock(true)
      } else {
        setTransactions(data.data)
        setTotal(data.total)
        setPages(data.pages)
        setUsingMock(false)
      }
    } catch {
      setTransactions(MOCK_TRANSACTIONS.slice(0, 15))
      setTotal(MOCK_TRANSACTIONS.length)
      setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter, sortBy, sortDir])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const handleAdd = async (body) => {
    await api.post('/transactions', body)
    fetchTransactions()
  }

  const handleEdit = async (body) => {
    await api.patch(`/transactions/${modal.id}`, body)
    fetchTransactions()
  }

  const handleDelete = async (id) => {
    await api.delete(`/transactions/${id}`)
    setDeleteId(null)
    fetchTransactions()
  }

  const handleExport = () => {
    const csv = transactionsToCSV(transactions)
    downloadFile(csv, `transactions-${new Date().toISOString().split('T')[0]}.csv`)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {modal && (
        <TransactionModal
          tx={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={modal === 'add' ? handleAdd : handleEdit}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-500 text-sm">{total} transaction{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary btn-sm">Export CSV</button>
          <button onClick={() => setModal('add')} className="btn-primary btn-sm">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {usingMock && (
        <div className="alert-info text-xs">
          Showing demo data. Add your first transaction to get started.
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9"
            placeholder="Search transactions..."
          />
        </div>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className="input w-auto">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={`${sortBy}-${sortDir}`} onChange={(e) => {
          const [by, dir] = e.target.value.split('-')
          setSortBy(by); setSortDir(dir); setPage(1)
        }} className="input w-auto">
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="amount-desc">Highest amount</option>
          <option value="amount-asc">Lowest amount</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="spinner w-7 h-7" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No transactions found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Category</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        tx.type === 'income' ? 'bg-primary-100 text-primary-600' : 'bg-red-100 text-red-500'
                      }`}>
                        {tx.type === 'income' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{tx.title}</p>
                        {tx.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{tx.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td><span className="badge-gray">{tx.category}</span></td>
                  <td className="text-gray-500 text-xs">{formatDate(tx.date)}</td>
                  <td className="text-right">
                    <span className={`font-semibold text-sm ${tx.type === 'income' ? 'text-primary-600' : 'text-red-500'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal(tx)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      {deleteId === tx.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(tx.id)} className="text-xs text-red-600 font-medium hover:underline">Confirm</button>
                          <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteId(tx.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary btn-sm"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn-secondary btn-sm"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
