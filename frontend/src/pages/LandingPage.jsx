import { Link } from 'react-router-dom'
import {
  TrendingUp, Shield, BarChart3, PiggyBank, MessageSquare,
  ArrowRight, Check, Star, Lock, Zap
} from 'lucide-react'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Smart Analytics',
    desc: 'Visualise your spending trends with interactive charts and monthly breakdowns.',
  },
  {
    icon: PiggyBank,
    title: 'Budget Tracking',
    desc: 'Set category budgets and get alerts before you overspend.',
  },
  {
    icon: MessageSquare,
    title: 'AI Financial Advisor',
    desc: 'Get personalised investment, savings, and tax optimisation guidance.',
  },
  {
    icon: Shield,
    title: 'Bank-grade Security',
    desc: 'Argon2id hashing, JWT cookies, OTP verification — your data is protected.',
  },
  {
    icon: TrendingUp,
    title: 'Income & Expense Tracking',
    desc: 'Categorise, search, and export all your financial transactions.',
  },
  {
    icon: Zap,
    title: 'Instant Reports',
    desc: 'Generate and export financial summaries as CSV or printable reports.',
  },
]

const SECURITY_ITEMS = [
  'Argon2id password hashing — industry-leading security',
  'JWT stored in HttpOnly cookies — not localStorage',
  'Real email OTP with 5-minute expiry and max 5 attempts',
  'CORS-protected API with rate limiting',
  'No secrets, OTPs, or tokens exposed to JavaScript',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">AI Finance Maker</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost btn-sm">Sign in</Link>
            <Link to="/register" className="btn-primary btn-sm">Get started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-50 via-white to-blue-50" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] -z-10 bg-primary-100 rounded-full opacity-30 blur-3xl translate-x-1/2 -translate-y-1/2" />

        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold mb-6">
            <Star size={11} />
            Personal Finance, Reimagined
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight text-balance mb-6">
            Take control of your{' '}
            <span className="gradient-text">financial future</span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
            AI Finance Maker helps you track expenses, set budgets, analyse spending patterns,
            and get personalised financial guidance — all in one secure platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary btn-lg">
              Start for free <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="btn-secondary btn-lg">
              Sign in to dashboard
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-4">No credit card required. INR currency. Secure by design.</p>
        </div>

        {/* Product preview */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="card-md p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1" />
              <span className="text-xs text-gray-500">AI Finance Maker Dashboard</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Total Income', val: '₹5.48L', color: 'text-green-400' },
                { label: 'Total Expenses', val: '₹2.96L', color: 'text-red-400' },
                { label: 'Net Savings', val: '₹2.52L', color: 'text-blue-400' },
                { label: 'Savings Rate', val: '46%', color: 'text-purple-400' },
              ].map((s) => (
                <div key={s.label} className="bg-gray-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                </div>
              ))}
            </div>
            <div className="bg-gray-800 rounded-xl p-3 h-28 flex items-center justify-center">
              <div className="flex items-end gap-1.5 h-full py-2">
                {[45, 55, 42, 62, 48, 58].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-5 bg-primary-600 rounded-t" style={{ height: `${h}%` }} />
                    <div className="w-5 bg-red-500 rounded-t" style={{ height: `${h * 0.6}%` }} />
                  </div>
                ))}
              </div>
              <p className="ml-4 text-xs text-gray-500">Monthly Income vs Expenses</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900">Everything you need to manage money</h2>
            <p className="text-gray-500 mt-3">Powerful features wrapped in a clean, intuitive interface.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 hover:shadow-card-md transition-shadow duration-200">
                <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={18} className="text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-800 mb-1.5">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="card p-10 bg-gradient-to-br from-primary-50 to-white border-primary-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Lock size={18} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Security you can trust</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SECURITY_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={11} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-600">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-primary-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to take control?</h2>
          <p className="text-primary-100 mb-8">Join and start building your financial future today.</p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors shadow-lg">
            Create your free account <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-700">AI Finance Maker</span>
          </div>
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} AI Finance Maker. Built for educational demonstration.
          </p>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link to="/login" className="hover:text-gray-600">Sign in</Link>
            <Link to="/register" className="hover:text-gray-600">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
