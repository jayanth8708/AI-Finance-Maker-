import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import { formatCurrency, percentage } from '../lib/utils'
import { MOCK_BUDGETS, CATEGORIES } from '../data/mockData'

function BudgetModal({ budget, onClose, onSave }) {
  const [form, setForm] = useState(budget
    ? { category: budget.category, monthly_limit: String(budget.monthly_limit) }
    : { category: '', monthly_limit: '' }
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.monthly_limit) { setError('All fields required.'); return }
    setLoading(true); setError('')
    try {
      await onSave({ category: form.category, monthly_limit: parseFloat(form.monthly_limit) })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">{budget ? 'Edit budget' : 'Add budget'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        {error && <div className="alert-error mb-4 text-xs">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Category *</label>
            <select name="category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="input" disabled={!!budget} required>
              <option value="">Select category...</option>
              {CATEGORIES.expense.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Monthly limit (₹) *</label>
            <input type="number" min="1" step="100" value={form.monthly_limit} onChange={(e) => setForm((f) => ({ ...f, monthly_limit: e.target.value }))} className="input" placeholder="5000" required />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <span className="spinner" /> : budget ? 'Save' : 'Add budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(false)
  const [usingMock, setUsingMock] = useState(false)
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const fetchBudgets = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/budgets')
      if (data.length === 0) {
        setBudgets(MOCK_BUDGETS); setUsingMock(true)
      } else {
        setBudgets(data); setUsingMock(false)
      }
    } catch {
      setBudgets(MOCK_BUDGETS); setUsingMock(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBudgets() }, [])

  const handleSave = async (body) => {
    if (modal?.id) {
      await api.patch(`/budgets/${modal.id}`, { monthly_limit: body.monthly_limit })
    } else {
      await api.post('/budgets', body)
    }
    fetchBudgets()
  }

  const handleDelete = async (id) => {
    await api.delete(`/budgets/${id}`)
    setDeleteId(null)
    fetchBudgets()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {modal !== null && (
        <BudgetModal
          budget={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budgets</h1>
          <p className="text-gray-500 text-sm">Set and track monthly spending limits</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary btn-sm">
          <Plus size={14} /> Add budget
        </button>
      </div>

      {usingMock && <div className="alert-info text-xs">Showing demo budgets. Set your own to track real spending.</div>}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="spinner w-7 h-7" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => {
            const pct = percentage(budget.spent, budget.monthly_limit)
            const isOver = pct >= 100
            const isWarning = pct >= 80 && !isOver

            return (
              <div key={budget.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{budget.category}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Monthly limit: {formatCurrency(budget.monthly_limit)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {isOver && <AlertTriangle size={14} className="text-red-500" />}
                    {isWarning && <AlertTriangle size={14} className="text-yellow-500" />}
                    <button onClick={() => setModal(budget)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <Pencil size={13} />
                    </button>
                    {deleteId === budget.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(budget.id)} className="text-xs text-red-600 font-medium">Confirm</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs text-gray-400">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteId(budget.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className={`font-semibold ${isOver ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-gray-800'}`}>
                      {formatCurrency(budget.spent)} spent
                    </span>
                    <span className="text-gray-400 text-xs">{Math.round(pct)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: isOver ? '#ef4444' : isWarning ? '#f59e0b' : '#16a34a',
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    {isOver
                      ? `${formatCurrency(budget.spent - budget.monthly_limit)} over budget`
                      : `${formatCurrency(budget.monthly_limit - budget.spent)} remaining`}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
