import { useState, useEffect, useRef } from 'react'

/**
 * Six-digit OTP input with auto-advance, paste support, and backspace handling.
 */
export function OTPInput({ value = '', onChange, disabled = false, error = false }) {
  const [digits, setDigits] = useState(Array(6).fill(''))
  const refs = useRef([])

  // Sync external value → internal digits
  useEffect(() => {
    if (value.length === 6) {
      setDigits(value.split(''))
    } else {
      setDigits(Array(6).fill(''))
    }
  }, [value])

  const emitChange = (newDigits) => {
    onChange(newDigits.join(''))
  }

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) return

    const char = raw[raw.length - 1]
    const newDigits = [...digits]
    newDigits[index] = char
    setDigits(newDigits)
    emitChange(newDigits)

    if (index < 5) {
      refs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const newDigits = [...digits]
      if (newDigits[index]) {
        newDigits[index] = ''
        setDigits(newDigits)
        emitChange(newDigits)
      } else if (index > 0) {
        newDigits[index - 1] = ''
        setDigits(newDigits)
        emitChange(newDigits)
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const newDigits = Array(6).fill('')
    text.split('').forEach((ch, i) => { newDigits[i] = ch })
    setDigits(newDigits)
    emitChange(newDigits)
    refs.current[Math.min(text.length, 5)]?.focus()
  }

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className={`otp-input ${error ? 'border-red-400 ring-red-200' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  )
}
