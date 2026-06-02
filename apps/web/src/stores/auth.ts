/**
 * Zustand 状态管理 — 登录状态
 */
import { create } from 'zustand'
import client from '../api/client'

interface AuthState {
  user: any | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    const res = await client.post('/auth/login', { email, password })
    localStorage.setItem('access_token', res.data.access_token)
    localStorage.setItem('refresh_token', res.data.refresh_token)
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null })
  },

  fetchUser: async () => {
    set({ loading: true })
    try {
      const res = await client.get('/auth/me')
      set({ user: res.data })
    } catch {
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
}))
