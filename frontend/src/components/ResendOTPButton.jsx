import { useState, useEffect, useRef, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'

/**
 * Resend OTP button with countdown timer.
 * Shows "Resend code" when cooldown expires; shows countdown otherwise.
 */
export function ResendOTPButton({ onResend, cooldownSeconds = 60, loading = false }) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
  const [resending, setResending] = useState(false)
  const timerRef = useRef(null)

  const startCountdown = useCallback((seconds) => {
    setSecondsLeft(seconds)
    clearInterval(timerRef.current)
    if (seconds > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
  }, [])

  useEffect(() => {
    startCountdown(cooldownSeconds)
    return () => clearInterval(timerRef.current)
  }, [cooldownSeconds, startCountdown])

  const handleResend = async () => {
    if (secondsLeft > 0 || resending) return
    setResending(true)
    try {
      await onResend()
      startCountdown(cooldownSeconds)
    } finally {
      setResending(false)
    }
  }

  const canResend = secondsLeft === 0 && !resending && !loading

  return (
    <div className="text-center text-sm text-gray-500">
      {secondsLeft > 0 ? (
        <span>Resend code in <span className="font-semibold text-gray-700">{secondsLeft}s</span></span>
      ) : (
        <button
          onClick={handleResend}
          disabled={!canResend}
          className="inline-flex items-center gap-1.5 text-primary-600 font-semibold hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {resending ? (
            <>
              <span className="spinner w-3.5 h-3.5" />
              Sending...
            </>
          ) : (
            <>
              <RotateCcw size={14} />
              Resend code
            </>
          )}
        </button>
      )}
    </div>
  )
}
