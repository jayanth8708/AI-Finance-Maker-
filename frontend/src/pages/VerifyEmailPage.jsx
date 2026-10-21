import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { TrendingUp, Mail } from 'lucide-react'
import { OTPInput } from '../components/OTPInput'
import { ResendOTPButton } from '../components/ResendOTPButton'
import api from '../lib/api'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  const maskedEmail = location.state?.maskedEmail || email

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError('Please enter all 6 digits.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/verify-email', { email, otp })
      setSuccess('Email verified! Redirecting to sign in...')
      setTimeout(() => navigate('/login'), 1800)
    } catch (err) {
      setError(err.message || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    try {
      await api.post('/auth/resend-otp', { email, otp_type: 'email_verification' })
    } catch (err) {
      setError(err.message || 'Failed to resend code')
      throw err
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No email found. Please register or sign in.</p>
          <Link to="/register" className="btn-primary btn">Create account</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-2xl mb-4 shadow-card-md">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
          <p className="text-gray-500 text-sm mt-1">We sent a 6-digit code to</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Mail size={14} className="text-primary-600" />
            <span className="text-sm font-semibold text-gray-800">{maskedEmail}</span>
          </div>
        </div>

        <div className="card p-8">
          {error && <div className="alert-error mb-5">{error}</div>}
          {success && <div className="alert-success mb-5">{success}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <OTPInput
              value={otp}
              onChange={setOtp}
              disabled={loading || !!success}
              error={!!error}
            />

            <button
              type="submit"
              disabled={loading || otp.length < 6 || !!success}
              className="btn-primary btn-lg w-full mt-6"
            >
              {loading ? <><span className="spinner" />Verifying...</> : 'Verify email'}
            </button>

            <div className="mt-5">
              <ResendOTPButton onResend={handleResend} loading={loading} />
            </div>
          </form>

          <div className="divider" />
          <p className="text-center text-sm text-gray-500">
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
              Back to registration
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
