import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { Spinner } from '../components/Spinner'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { user, token } = await authApi.login(email, password)
      setAuth(user, token)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">🐝</span>
          <h1 className="text-2xl font-bold text-white mt-3">Welcome back</h1>
          <p className="text-zinc-500 mt-1 text-sm">Sign in to your Hive account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {loading ? <Spinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-zinc-500 text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-violet-400 hover:text-violet-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
