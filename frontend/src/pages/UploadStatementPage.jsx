import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud, FileText, CheckCircle2, XCircle,
  AlertCircle, ChevronRight, RefreshCw, Info
} from 'lucide-react'
import api from '../lib/api'

const ACCEPTED = ['.csv', '.xlsx', '.xls', '.pdf']
const MAX_MB = 10

function isValidFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase()
  return ACCEPTED.includes(ext) && file.size <= MAX_MB * 1024 * 1024
}

function FormatBadge({ label, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${color}`}>
      {label}
    </span>
  )
}

export default function UploadStatementPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [dragging, setDragging] = useState(false)
  const [file, setFile]         = useState(null)
  const [status, setStatus]     = useState('idle') // idle | uploading | success | error
  const [result, setResult]     = useState(null)   // { inserted, skipped, total_parsed, message }
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState(0)

  const selectFile = useCallback((f) => {
    setErrorMsg('')
    setResult(null)
    setStatus('idle')
    if (!f) return
    if (!isValidFile(f)) {
      setErrorMsg(
        f.size > MAX_MB * 1024 * 1024
          ? `File is too large. Maximum size is ${MAX_MB} MB.`
          : `Unsupported format. Please upload a CSV, PDF, XLSX, or XLS file.`
      )
      return
    }
    setFile(f)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    selectFile(dropped)
  }, [selectFile])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  const handleFileInput = (e) => selectFile(e.target.files[0])

  const handleUpload = async () => {
    if (!file) return
    setStatus('uploading')
    setProgress(0)
    setErrorMsg('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Simulate progress ticks while waiting for backend
      const ticker = setInterval(() => {
        setProgress((p) => (p < 85 ? p + Math.random() * 12 : p))
      }, 400)

      const { data } = await api.post('/upload/statement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })

      clearInterval(ticker)
      setProgress(100)
      setResult(data)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || 'Upload failed. Please try again.')
    }
  }

  const handleReset = () => {
    setFile(null)
    setStatus('idle')
    setResult(null)
    setErrorMsg('')
    setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const extColor = (ext) => {
    const map = { csv: 'bg-green-100 text-green-700', pdf: 'bg-red-100 text-red-700', xlsx: 'bg-blue-100 text-blue-700', xls: 'bg-blue-100 text-blue-700' }
    return map[ext] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Bank Statement</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload your bank statement to automatically import all transactions.
        </p>
      </div>

      {/* Supported formats info */}
      <div className="card p-4 flex items-start gap-3 bg-blue-50 border border-blue-100">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">Supported formats</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['CSV', 'PDF', 'XLSX', 'XLS'].map((f) => (
              <FormatBadge key={f} label={f} color="bg-blue-100 text-blue-700" />
            ))}
          </div>
          <p className="text-xs text-blue-700 mt-1.5">
            Your file must have columns for <strong>Date</strong>, <strong>Description/Narration</strong>, and <strong>Debit/Credit</strong> amounts.
            Most Indian bank statements (SBI, HDFC, ICICI, Axis, Kotak) are supported automatically.
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {status !== 'success' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer
            ${dragging
              ? 'border-primary-400 bg-primary-50 scale-[1.01]'
              : file
                ? 'border-primary-300 bg-primary-50/50 cursor-default'
                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 bg-white'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />

          {!file ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                <UploadCloud size={32} className="text-primary-600" />
              </div>
              <p className="text-base font-semibold text-gray-700">
                Drag & drop your bank statement here
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse files</p>
              <p className="text-xs text-gray-400 mt-3">CSV, PDF, XLSX, XLS · Max {MAX_MB} MB</p>
            </>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <FileText size={24} className="text-primary-600" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{file.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB ·{' '}
                  <FormatBadge
                    label={file.name.split('.').pop().toUpperCase()}
                    color={extColor(file.name.split('.').pop().toLowerCase())}
                  />
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleReset() }}
                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                title="Remove file"
              >
                <XCircle size={20} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload progress */}
      {status === 'uploading' && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Parsing & uploading transactions...</span>
            <span className="text-gray-400">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">This may take a few seconds for large files.</p>
        </div>
      )}

      {/* Success result */}
      {status === 'success' && result && (
        <div className="card p-6 space-y-5 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Upload successful!</p>
              <p className="text-sm text-gray-500">{file.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Parsed',   value: result.total_parsed,  color: 'text-gray-700' },
              { label: 'Imported',       value: result.inserted,       color: 'text-green-600' },
              { label: 'Duplicates Skipped', value: result.skipped,   color: 'text-yellow-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {result.inserted === 0 && result.skipped > 0 && (
            <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 rounded-lg p-3">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>All transactions from this file were already imported previously.</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleReset}
              className="btn-secondary flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              Upload another
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary flex items-center gap-1.5"
            >
              View Dashboard
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Upload button */}
      {file && status === 'idle' && (
        <button
          onClick={handleUpload}
          className="btn-primary btn-lg w-full"
        >
          <UploadCloud size={18} />
          Import Transactions from Statement
        </button>
      )}

      {/* Help section */}
      <div className="card p-5 space-y-3">
        <p className="text-sm font-semibold text-gray-700">How to export your bank statement</p>
        <div className="space-y-2 text-sm text-gray-500">
          {[
            { bank: 'SBI', tip: 'Net Banking → e-Statements → Download as Excel or CSV' },
            { bank: 'HDFC', tip: 'Net Banking → My Accounts → Statement → Download CSV' },
            { bank: 'ICICI', tip: 'iMobile / Net Banking → Statements → Download Excel' },
            { bank: 'Axis', tip: 'Net Banking → Account Statement → Download (Excel/CSV)' },
          ].map(({ bank, tip }) => (
            <div key={bank} className="flex gap-2">
              <span className="font-semibold text-gray-700 w-10 flex-shrink-0">{bank}</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
