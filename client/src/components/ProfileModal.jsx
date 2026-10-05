import { useState } from 'react'
import { useAuthContext } from '@/app/providers/AuthProvider'

export function ProfileModal({ isOpen, onClose, onLogout }) {
  const { user, updateProfile } = useAuthContext()

  const [name,     setName]     = useState(user?.name ?? '')
  const [email,    setEmail]    = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const payload = { name, email }
      if (password.trim()) payload.password = password
      await updateProfile(payload)
      setPassword('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-mono select-none">
      <div className="w-full max-w-md bg-surface-container-lowest border border-surface-variant p-6 space-y-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">account_circle</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface">USER PROFILE</h2>
          </div>
          <button
            onClick={onClose}
            className="text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Success / Error Banners */}
        {error && (
          <div className="p-2.5 bg-error-container/20 border border-error/50 text-error text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs">
            ✓ Profile details updated successfully!
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-outline text-[11px] uppercase tracking-wider mb-1">Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container-high border border-surface-variant text-on-surface p-2 focus:border-primary outline-none"
              placeholder="Your Name"
            />
          </div>

          <div>
            <label className="block text-outline text-[11px] uppercase tracking-wider mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-container-high border border-surface-variant text-on-surface p-2 focus:border-primary outline-none"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-outline text-[11px] uppercase tracking-wider mb-1">New Password (optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-high border border-surface-variant text-on-surface p-2 focus:border-primary outline-none"
              placeholder="Leave blank to keep unchanged"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary hover:bg-primary-container text-on-primary font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {loading ? 'SAVING…' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>

        {/* Logout Section */}
        <div className="pt-3 border-t border-surface-variant flex items-center justify-between">
          <span className="text-[11px] text-outline">Session management</span>
          <button
            onClick={() => {
              onClose()
              onLogout?.()
            }}
            className="px-3 py-1.5 bg-error/10 hover:bg-error/20 border border-error/40 text-error hover:text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">logout</span>
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  )
}
