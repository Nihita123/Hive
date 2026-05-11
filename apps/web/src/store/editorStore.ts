import { create } from 'zustand'
import type { ProjectWithCode, SocketUser, ExecutionResult, CursorPosition } from '../types'

interface RemoteCursor {
  userId: string
  email: string
  position: CursorPosition
}

interface EditorState {
  project: ProjectWithCode | null
  localCode: string
  localVersion: number
  activeUsers: SocketUser[]
  typingUsers: Set<string>          // userIds currently typing
  remoteCursors: Map<string, RemoteCursor>
  executionResult: ExecutionResult | null
  isExecuting: boolean
  isSaving: boolean

  setProject: (project: ProjectWithCode) => void
  setLocalCode: (code: string) => void
  applyRemoteSync: (code: string, version: number) => void
  setActiveUsers: (users: SocketUser[]) => void
  addActiveUser: (user: SocketUser) => void
  removeActiveUser: (userId: string) => void
  setTyping: (userId: string, isTyping: boolean) => void
  setRemoteCursor: (userId: string, email: string, position: CursorPosition) => void
  removeRemoteCursor: (userId: string) => void
  setExecutionResult: (result: ExecutionResult | null) => void
  setIsExecuting: (v: boolean) => void
  setIsSaving: (v: boolean) => void
  reset: () => void
}

const TYPING_TIMEOUT_MS = 2000

const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  localCode: '',
  localVersion: 1,
  activeUsers: [],
  typingUsers: new Set(),
  remoteCursors: new Map(),
  executionResult: null,
  isExecuting: false,
  isSaving: false,

  setProject: (project) =>
    set({ project, localCode: project.code, localVersion: project.version }),

  setLocalCode: (code) => set({ localCode: code }),

  applyRemoteSync: (code, version) =>
    set((s) => ({
      localCode: code,
      localVersion: version,
      project: s.project ? { ...s.project, code, version } : null,
    })),

  setActiveUsers: (users) => set({ activeUsers: users }),

  addActiveUser: (user) =>
    set((s) => {
      if (s.activeUsers.some((u) => u.id === user.id)) return s
      return { activeUsers: [...s.activeUsers, user] }
    }),

  removeActiveUser: (userId) =>
    set((s) => ({
      activeUsers: s.activeUsers.filter((u) => u.id !== userId),
    })),

  setTyping: (userId, isTyping) => {
    // Clear any existing timeout for this user
    const existing = typingTimeouts.get(userId)
    if (existing) clearTimeout(existing)

    if (isTyping) {
      // Auto-clear after 2s of no new typing events
      const timer = setTimeout(() => {
        get().setTyping(userId, false)
      }, TYPING_TIMEOUT_MS)
      typingTimeouts.set(userId, timer)
      set((s) => {
        const next = new Set(s.typingUsers)
        next.add(userId)
        return { typingUsers: next }
      })
    } else {
      typingTimeouts.delete(userId)
      set((s) => {
        const next = new Set(s.typingUsers)
        next.delete(userId)
        return { typingUsers: next }
      })
    }
  },

  setRemoteCursor: (userId, email, position) =>
    set((s) => {
      const next = new Map(s.remoteCursors)
      next.set(userId, { userId, email, position })
      return { remoteCursors: next }
    }),

  removeRemoteCursor: (userId) =>
    set((s) => {
      const next = new Map(s.remoteCursors)
      next.delete(userId)
      return { remoteCursors: next }
    }),

  setExecutionResult: (result) => set({ executionResult: result }),
  setIsExecuting: (v) => set({ isExecuting: v }),
  setIsSaving: (v) => set({ isSaving: v }),

  reset: () =>
    set({
      project: null,
      localCode: '',
      localVersion: 1,
      activeUsers: [],
      typingUsers: new Set(),
      remoteCursors: new Map(),
      executionResult: null,
      isExecuting: false,
      isSaving: false,
    }),
}))
