// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  createdAt: string
}

export interface AuthResponse {
  user: User
  token: string
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string
  name: string | null
  ownerId: string
  createdAt: string
  _count?: { members: number }
}

export interface RoomMember {
  user: { id: string; email: string }
  joinedAt: string
}

export interface RoomDetails extends Room {
  members: RoomMember[]
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  roomId: string
  name: string
  language: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface ProjectWithCode extends Project {
  code: string
}

// ─── Execution ────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'unknown'

export interface ExecutionResult {
  jobId: string
  status: JobStatus
  output?: string
  error?: string
  exitCode?: number | null
  durationMs?: number
  timedOut?: boolean
}

// ─── Socket event payloads ────────────────────────────────────────────────────

export interface SocketUser {
  id: string
  email: string
}

export interface CursorPosition {
  line: number
  column: number
}

export interface CodeSyncedPayload {
  projectId: string
  code: string
  version: number
  userId: string
}

export interface VersionConflictPayload {
  projectId: string
  serverVersion: number
  serverCode: string
}

export interface CursorMovePayload {
  projectId: string
  cursorPosition: CursorPosition
  userId: string
}

export interface ExecutionCompletedPayload {
  jobId: string
  projectId: string
  status: 'completed' | 'failed'
  output: string
  error: string
  exitCode: number | null
  durationMs: number
  timedOut: boolean
}
