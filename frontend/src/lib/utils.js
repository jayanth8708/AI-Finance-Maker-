/** Format number as INR currency */
export function formatCurrency(amount, compact = false) {
  if (compact && Math.abs(amount) >= 100000) {
    const lakhs = amount / 100000
    return `₹${lakhs.toFixed(1)}L`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format date to readable string */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format YYYY-MM to Month YYYY */
export function formatMonth(monthStr) {
  if (!monthStr) return ''
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** Mask email address */
export function maskEmail(email) {
  if (!email) return ''
  const [local, domain] = email.split('@')
  const masked = local.slice(0, 2) + '*'.repeat(Math.max(0, local.length - 2))
  return `${masked}@${domain}`
}

/** Get initials from name */
export function getInitials(name) {
  if (!name) return ''
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Clamp a number between min and max */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/** Get percentage, safe division */
export function percentage(value, total) {
  if (!total) return 0
  return clamp((value / total) * 100, 0, 100)
}

/** Download a string as a file */
export function downloadFile(content, filename, type = 'text/csv') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Convert transactions array to CSV */
export function transactionsToCSV(transactions) {
  const headers = ['Date', 'Title', 'Category', 'Type', 'Amount (INR)', 'Description']
  const rows = transactions.map((t) => [
    t.date,
    `"${t.title}"`,
    t.category,
    t.type,
    t.amount,
    `"${t.description || ''}"`,
  ])
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/** Category color mapping */
export const CATEGORY_COLORS = {
  Food: '#22c55e',
  Transport: '#3b82f6',
  Shopping: '#f59e0b',
  Entertainment: '#8b5cf6',
  Healthcare: '#ef4444',
  Education: '#06b6d4',
  Utilities: '#64748b',
  Rent: '#f97316',
  Salary: '#16a34a',
  'Freelance': '#10b981',
  Investment: '#7c3aed',
  Other: '#9ca3af',
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#9ca3af'
}
