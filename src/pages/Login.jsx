import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Church } from 'lucide-react'

import { useAuth } from '../lib/AuthContext'

function friendlyError(error) {
  if (error?.code === 401 || error?.code === 400) {
    return 'Invalid email or password.'
  }
  if (error?.code === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.'
  }
  if (error?.code === 0) {
    return 'Cannot reach the server. Check your connection and try again.'
  }
  return error?.message || 'Could not sign in. Please try again.'
}

export default function Login() {
  const { user, loading, login } = useAuth()
  const location = useLocation()
  const redirectTo = location.state?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Already signed in (or just signed in): go to the app
  if (!loading && user) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setError('')

    try {
      await login(email.trim(), password)
      // The redirect happens automatically once the user is set.
    } catch (err) {
      console.error('Sign in failed:', err)
      setError(friendlyError(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F9FC] p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Church size={42} className="text-[#142D4E]" />
          <h1 className="mt-3 text-2xl font-bold text-[#142D4E]">
            ChurchReport
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage your church reports.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Secure access for authorized church users
        </p>
      </section>
    </main>
  )
}