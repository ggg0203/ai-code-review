/**
 * 主题状态管理 — 亮色/暗黑切换
 */
import { create } from 'zustand'

interface ThemeState {
  dark: boolean
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  dark: localStorage.getItem('theme') === 'dark',
  toggle: () => set((state) => {
    const next = !state.dark
    localStorage.setItem('theme', next ? 'dark' : 'light')
    return { dark: next }
  }),
}))
