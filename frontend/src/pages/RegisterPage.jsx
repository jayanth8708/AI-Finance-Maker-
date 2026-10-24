import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, TrendingUp, Check, X } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

function PasswordRule({ met, text }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? 'text-primary-600' : 'text-gray-400'}`}>
      {met ? <Check size={11} /> : <X size={11} />}
      {text}
    </li>
  )
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm_password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pw = form.password
  const rules = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw),
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Please enter your name.'); return }
    if (!form.email.trim()) { setError('Please enter your email.'); return }
    if (!Object.values(rules).every(Boolean)) { setError('Password does not meet requirements.'); return }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return }

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirm_password: form.confirm_password,
      })
      // Registration now logs the user in directly — refresh auth state and go to dashboard
      await refreshUser()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      // Strip Pydantic v2's "Value error, " prefix from validation messages
      const raw = err.message || 'Registration failed'
      setError(raw.replace(/Value error,\s*/gi, ''))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-2xl mb-4 shadow-card-md">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
          <p className="text-gray-500 text-sm mt-1">Start your financial journey</p>
        </div>

        <div className="card p-8">
          {error && <div className="alert-error mb-5">{error}</div>}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange}
                className="input"
                placeholder="Arjun Sharma"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className="input"
                placeholder="you@example.com"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  className="input pr-11"
                  placeholder="Create a strong password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {form.password && (
                <ul className="mt-2 space-y-1 pl-1">
                  <PasswordRule met={rules.length} text="At least 8 characters" />
                  <PasswordRule met={rules.upper}  text="One uppercase letter" />
                  <PasswordRule met={rules.lower}  text="One lowercase letter" />
                  <PasswordRule met={rules.digit}  text="One number" />
                </ul>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="label">Confirm password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={form.confirm_password}
                onChange={handleChange}
                className={`input ${
                  form.confirm_password && form.confirm_password !== form.password
                    ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
                    : ''
                }`}
                placeholder="Repeat your password"
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-lg w-full mt-1"
            >
              {loading ? <><span className="spinner" />Creating account...</> : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
