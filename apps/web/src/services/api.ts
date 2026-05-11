import axios from 'axios'
import type {
  AuthResponse,
  User,
  Room,
  RoomDetails,
  Project,
  ProjectWithCode,
  ExecutionResult,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Normalise error shape
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ?? err.message ?? 'Something went wrong'
    return Promise.reject(new Error(message))
  },
)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { email, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  me: () =>
    api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const roomsApi = {
  myRooms: () =>
    api.get<{ rooms: Room[] }>('/rooms/me').then((r) => r.data.rooms),

  create: (name?: string) =>
    api.post<{ room: Room }>('/rooms', { name }).then((r) => r.data.room),

  join: (roomId: string) =>
    api.post<{ ok: boolean }>(`/rooms/${roomId}/join`).then((r) => r.data),

  leave: (roomId: string) =>
    api.post<{ ok: boolean }>(`/rooms/${roomId}/leave`).then((r) => r.data),

  details: (roomId: string) =>
    api.get<{ room: RoomDetails }>(`/rooms/${roomId}`).then((r) => r.data.room),

  delete: (roomId: string) =>
    api.delete<{ ok: boolean }>(`/rooms/${roomId}`).then((r) => r.data),
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsApi = {
  list: (roomId: string) =>
    api.get<{ projects: Project[] }>(`/projects/room/${roomId}`).then((r) => r.data.projects),

  get: (projectId: string) =>
    api.get<{ project: ProjectWithCode }>(`/projects/${projectId}`).then((r) => r.data.project),

  create: (roomId: string, name: string, language: string) =>
    api.post<{ project: ProjectWithCode }>('/projects', { roomId, name, language }).then((r) => r.data.project),

  updateCode: (projectId: string, code: string, version: number) =>
    api.patch<{ project: ProjectWithCode }>(`/projects/${projectId}/code`, { code, version }).then((r) => r.data.project),

  delete: (projectId: string) =>
    api.delete<{ ok: boolean }>(`/projects/${projectId}`).then((r) => r.data),

  activeUsers: (projectId: string) =>
    api.get<{ activeUsers: { id: string; email: string }[] }>(`/projects/${projectId}/active-users`).then((r) => r.data.activeUsers),
}

// ─── Execution ────────────────────────────────────────────────────────────────

export const executionApi = {
  run: (projectId: string, language: string, code: string, input = '') =>
    api.post<{ jobId: string }>('/execute', { projectId, language, code, input }).then((r) => r.data),

  status: (jobId: string) =>
    api.get<ExecutionResult>(`/execute/${jobId}`).then((r) => r.data),
}

export default api
