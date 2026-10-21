import { useState, useRef } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react'

const ACCEPTED_TYPES = {
  'application/pdf': 'PDF',
  'text/csv': 'CSV',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
}

function generatePreview(fileName) {
  return [
    { date: '2025-09-01', description: 'Amazon Pay', debit: 1200, credit: null },
    { date: '2025-09-03', description: 'Salary Credit', debit: null, credit: 85000 },
    { date: '2025-09-05', description: 'Swiggy', debit: 480, credit: null },
    { date: '2025-09-08', description: 'Netflix', debit: 649, credit: null },
    { date: '2025-09-10', description: 'Rent Transfer', debit: 18000, credit: null },
  ]
}

export default function StatementsPage() {
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES[file.type] && !file.name.match(/\.(pdf|csv|xls|xlsx)$/i)) {
      return 'Unsupported file type. Please upload PDF, CSV, XLS, or XLSX files.'
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size exceeds 10 MB limit.'
    }
    return null
  }

  const handleFiles = (newFiles) => {
    setError('')
    const validated = []
    for (const file of newFiles) {
      const err = validateFile(file)
      if (err) { setError(err); return }
      validated.push({ file, id: Date.now() + Math.random(), status: 'pending' })
    }
    setFiles((f) => [...f, ...validated])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles([...e.dataTransfer.files])
  }

  const handleProcess = (fileEntry) => {
    setProcessing(true)
    setTimeout(() => {
      setFiles((prev) => prev.map((f) => f.id === fileEntry.id ? { ...f, status: 'processed' } : f))
      setPreview(generatePreview(fileEntry.file.name))
      setProcessing(false)
    }, 2000)
  }

  const removeFile = (id) => setFiles((f) => f.filter((file) => file.id !== id))

  const getExt = (filename) => filename.split('.').pop().toUpperCase()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bank Statements</h1>
        <p className="text-gray-500 text-sm">Upload statements to preview and import transactions</p>
      </div>

      <div className="alert-warning text-sm">
        <strong>Simulation only:</strong> Statement extraction is not yet integrated with a real parser.
        File upload and preview are simulated for demonstration purposes.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
          dragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-primary-25'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.csv,.xls,.xlsx"
          className="hidden"
          onChange={(e) => handleFiles([...e.target.files])}
        />
        <Upload size={36} className={`mx-auto mb-3 ${dragging ? 'text-primary-500' : 'text-gray-300'}`} />
        <p className="font-semibold text-gray-700">Drag & drop files here, or click to select</p>
        <p className="text-sm text-gray-400 mt-1">Supports PDF, CSV, XLS, XLSX — max 10 MB</p>
      </div>

      {error && <div className="alert-error text-sm">{error}</div>}

      {/* File list */}
      {files.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 pt-4 pb-2 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Uploaded Files</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {files.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{entry.file.name}</p>
                  <p className="text-xs text-gray-400">{getExt(entry.file.name)} · {(entry.file.size / 1024).toFixed(0)} KB</p>
                </div>
                {entry.status === 'pending' && (
                  <button
                    onClick={() => handleProcess(entry)}
                    disabled={processing}
                    className="btn-primary btn-sm"
                  >
                    {processing ? <span className="spinner w-3.5 h-3.5" /> : 'Extract'}
                  </button>
                )}
                {entry.status === 'processed' && (
                  <div className="flex items-center gap-1.5 text-primary-600 text-xs font-medium">
                    <CheckCircle size={14} />
                    Extracted
                  </div>
                )}
                <button onClick={() => removeFile(entry.id)} className="text-gray-300 hover:text-gray-500 ml-1">
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Extracted Preview (Simulated)</h2>
            <span className="badge-yellow text-xs">Simulation — not real extraction</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="text-right text-red-400">Debit</th>
                <th className="text-right text-primary-600">Credit</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  <td className="text-xs text-gray-500">{row.date}</td>
                  <td className="font-medium">{row.description}</td>
                  <td className="text-right text-red-500 font-medium">
                    {row.debit ? `₹${row.debit.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="text-right text-primary-600 font-medium">
                    {row.credit ? `₹${row.credit.toLocaleString('en-IN')}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-50">
            <button disabled className="btn-primary btn-sm opacity-50 cursor-not-allowed">
              Import to Transactions (Coming Soon)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
