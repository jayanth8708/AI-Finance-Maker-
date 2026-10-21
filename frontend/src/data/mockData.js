/**
 * Realistic synthetic INR financial data for demonstration.
 * Used when the backend has no transactions yet for a new user.
 */

export const CATEGORIES = {
  expense: [
    'Food',
    'Transport',
    'Shopping',
    'Entertainment',
    'Healthcare',
    'Education',
    'Utilities',
    'Rent',
    'Other',
  ],
  income: ['Salary', 'Freelance', 'Investment', 'Other'],
}

export const ALL_CATEGORIES = [...CATEGORIES.expense, ...CATEGORIES.income]

/** Generate realistic INR transactions for the last N months */
export function generateMockTransactions(count = 60) {
  const now = new Date()
  const transactions = []

  const incomeTemplates = [
    { title: 'Monthly Salary', category: 'Salary', amount: 85000 },
    { title: 'Freelance Project Payment', category: 'Freelance', amount: 15000 },
    { title: 'Mutual Fund Returns', category: 'Investment', amount: 4500 },
    { title: 'Consulting Fee', category: 'Freelance', amount: 8000 },
    { title: 'Dividend Income', category: 'Investment', amount: 2200 },
  ]

  const expenseTemplates = [
    { title: 'Monthly Rent', category: 'Rent', amount: 18000 },
    { title: 'Swiggy Order', category: 'Food', amount: 350 },
    { title: 'Zomato Delivery', category: 'Food', amount: 480 },
    { title: 'Grocery Shopping', category: 'Food', amount: 2800 },
    { title: 'Ola Cab Ride', category: 'Transport', amount: 280 },
    { title: 'Metro Card Recharge', category: 'Transport', amount: 500 },
    { title: 'Petrol', category: 'Transport', amount: 1200 },
    { title: 'Amazon Shopping', category: 'Shopping', amount: 1800 },
    { title: 'Myntra Purchase', category: 'Shopping', amount: 2400 },
    { title: 'Movie Tickets', category: 'Entertainment', amount: 600 },
    { title: 'OTT Subscription', category: 'Entertainment', amount: 499 },
    { title: 'Gym Membership', category: 'Healthcare', amount: 1500 },
    { title: 'Doctor Consultation', category: 'Healthcare', amount: 800 },
    { title: 'Online Course', category: 'Education', amount: 2999 },
    { title: 'Electricity Bill', category: 'Utilities', amount: 1400 },
    { title: 'Internet Bill', category: 'Utilities', amount: 799 },
    { title: 'Mobile Recharge', category: 'Utilities', amount: 399 },
    { title: 'Restaurant Dinner', category: 'Food', amount: 1200 },
    { title: 'Coffee Shop', category: 'Food', amount: 380 },
    { title: 'Weekend Outing', category: 'Entertainment', amount: 900 },
  ]

  let id = 1
  for (let i = 0; i < count; i++) {
    const isIncome = Math.random() < 0.2
    const template = isIncome
      ? incomeTemplates[Math.floor(Math.random() * incomeTemplates.length)]
      : expenseTemplates[Math.floor(Math.random() * expenseTemplates.length)]

    const daysAgo = Math.floor(Math.random() * 90)
    const date = new Date(now)
    date.setDate(date.getDate() - daysAgo)

    const variance = 0.85 + Math.random() * 0.3
    const amount = Math.round(template.amount * variance)

    transactions.push({
      id: id++,
      user_id: 1,
      title: template.title,
      amount,
      type: isIncome ? 'income' : 'expense',
      category: template.category,
      description: '',
      date: date.toISOString().split('T')[0],
      created_at: date.toISOString(),
    })
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
}

export const MOCK_TRANSACTIONS = generateMockTransactions(60)

export const MOCK_BUDGETS = [
  { id: 1, user_id: 1, category: 'Food', monthly_limit: 8000, spent: 5200 },
  { id: 2, user_id: 1, category: 'Transport', monthly_limit: 3000, spent: 2100 },
  { id: 3, user_id: 1, category: 'Shopping', monthly_limit: 5000, spent: 5800 },
  { id: 4, user_id: 1, category: 'Entertainment', monthly_limit: 2000, spent: 999 },
  { id: 5, user_id: 1, category: 'Utilities', monthly_limit: 2500, spent: 1598 },
  { id: 6, user_id: 1, category: 'Healthcare', monthly_limit: 2000, spent: 800 },
]

export const MOCK_MONTHLY_TRENDS = [
  { month: '2025-04', income: 87000, expense: 42000, savings: 45000 },
  { month: '2025-05', income: 92000, expense: 48000, savings: 44000 },
  { month: '2025-06', income: 88000, expense: 39000, savings: 49000 },
  { month: '2025-07', income: 95000, expense: 52000, savings: 43000 },
  { month: '2025-08', income: 89000, expense: 44000, savings: 45000 },
  { month: '2025-09', income: 97000, expense: 51000, savings: 46000 },
]

export const MOCK_CATEGORY_BREAKDOWN = [
  { category: 'Rent', total: 108000, count: 6 },
  { category: 'Food', total: 48000, count: 48 },
  { category: 'Shopping', total: 38000, count: 18 },
  { category: 'Transport', total: 22000, count: 32 },
  { category: 'Utilities', total: 18000, count: 18 },
  { category: 'Entertainment', total: 12000, count: 12 },
  { category: 'Healthcare', total: 9600, count: 8 },
  { category: 'Education', total: 8997, count: 3 },
]

export const MOCK_SUMMARY = {
  total_income: 548000,
  total_expense: 296000,
  net_savings: 252000,
  month_income: 97000,
  month_expense: 51000,
  month_savings: 46000,
}
