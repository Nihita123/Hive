import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { UserAvatar } from './UserAvatar'

export function Navbar() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
  }

  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center px-6 gap-4 flex-shrink-0">
      <Link to="/dashboard" className="text-white font-bold text-lg tracking-tight">
        🐝 Hive
      </Link>
      <div className="flex-1" />
      {user && (
        <div className="flex items-center gap-3">
          <UserAvatar email={user.email} size="sm" />
          <span className="text-zinc-400 text-sm hidden sm:block">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
