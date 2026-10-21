import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, Bell, LogOut, Check } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(user?.name || '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState({ text: '', type: '' })

  const handleNameSave = async () => {
    if (!name.trim() || name.trim() === user?.name) return
    setNameLoading(true)
    setNameMsg('')
    try {
      await api.patch('/users/profile', { name: name.trim() })
      await refreshUser()
      setNameMsg('Name updated successfully.')
    } catch (err) {
      setNameMsg(`Error: ${err.message}`)
    } finally {
      setNameLoading(false)
    }
  }

  const handlePwChange = async (e) => {
    e.preventDefault()
    if (passwords.new_password !== passwords.confirm) {
      setPwMsg({ text: 'Passwords do not match.', type: 'error' }); return
    }
    setPwLoading(true)
    setPwMsg({ text: '', type: '' })
    try {
      await api.post('/users/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      })
      setPasswords({ current_password: '', new_password: '', confirm: '' })
      setPwMsg({ text: 'Password changed successfully.', type: 'success' })
    } catch (err) {
      setPwMsg({ text: err.message, type: 'error' })
    } finally {
      setPwLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
            <User size={14} className="text-primary-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Profile</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1" placeholder="Your name" />
              <button onClick={handleNameSave} disabled={nameLoading || name === user?.name} className="btn-primary">
                {nameLoading ? <span className="spinner w-4 h-4" /> : <Check size={15} />}
              </button>
            </div>
            {nameMsg && <p className="text-xs mt-1.5 text-primary-600">{nameMsg}</p>}
          </div>
          <div>
            <label className="label">Email address</label>
            <input value={user?.email || ''} className="input bg-gray-50 text-gray-400" disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
          </div>
          <div>
            <label className="label">Currency</label>
            <select className="input" disabled>
              <option>INR — Indian Rupee (₹)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Currency is fixed to INR.</p>
          </div>
          <div>
            <label className="label">Member since</label>
            <input value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : ''} className="input bg-gray-50 text-gray-400" disabled />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center">
            <Lock size={14} className="text-primary-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-800">Change Password</h2>
        </div>

        {pwMsg.text && (
          <div className={`${pwMsg.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 text-sm`}>
            {pwMsg.text}
          </div>
        )}

        <form onSubmit={handlePwChange} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              type="password"
              value={passwords.current_password}
              onChange={(e) => setPasswords((p) => ({ ...p, current_password: e.target.value }))}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              value={passwords.new_password}
              onChange={(e) => setPasswords((p) => ({ ...p, new_password: e.target.value }))}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
              className={`input ${passwords.confirm && passwords.confirm !== passwords.new_password ? 'border-red-300' : ''}`}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" disabled={pwLoading} className="btn-primary">
            {pwLoading ? <><span className="spinner" />Changing...</> : 'Change password'}
          </button>
        </form>
      </div>

      {/* Logout */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Sign out</h2>
            <p className="text-sm text-gray-500 mt-0.5">Sign out of your account on this device</p>
          </div>
          <button onClick={handleLogout} className="btn-danger btn-sm">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
