import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import { connectSocket, disconnectSocket, updateSocketToken } from '../sockets/socket'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        localStorage.setItem('token', token)
        updateSocketToken(token)
        connectSocket()
        set({ user, token, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem('token')
        disconnectSocket()
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'hive-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    },
  ),
)
