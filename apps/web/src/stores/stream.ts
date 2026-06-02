/**
 * 流式审查状态持久化 — 切换页面不丢失内容
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface StreamState {
  /** 流式审查结果（StreamReview 页面） */
  streamResult: string
  /** 审查详情流式结果（ReviewDetail 页面） */
  detailResult: string
  /** 是否正在流式分析中 */
  streaming: boolean

  setStreamResult: (fn: (prev: string) => string) => void
  setDetailResult: (fn: (prev: string) => string) => void
  setStreaming: (v: boolean) => void
  clearStream: () => void
}

export const useStreamStore = create<StreamState>()(
  persist(
    (set) => ({
      streamResult: '',
      detailResult: '',
      streaming: false,

      setStreamResult: (fn) => set((s) => ({ streamResult: fn(s.streamResult) })),
      setDetailResult: (fn) => set((s) => ({ detailResult: fn(s.detailResult) })),
      setStreaming: (v) => set({ streaming: v }),
      clearStream: () => set({ streamResult: '', detailResult: '' }),
    }),
    { name: 'stream-store' }
  )
)
