import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { roomsApi, projectsApi } from '../services/api'
import type { RoomDetails, Project } from '../types'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { UserAvatar } from '../components/UserAvatar'
import { useAuthStore } from '../store/authStore'

const LANGUAGES = ['javascript', 'python', 'typescript', 'go', 'rust', 'cpp', 'java']

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [room, setRoom] = useState<RoomDetails | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLang, setNewLang] = useState('javascript')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!roomId) return
    Promise.all([roomsApi.details(roomId), projectsApi.list(roomId)])
      .then(([r, p]) => { setRoom(r); setProjects(p) })
      .catch(() => { toast.error('Failed to load room'); navigate('/dashboard') })
      .finally(() => setLoading(false))
  }, [roomId])

  const handleCreateProject = async () => {
    if (!roomId || !newName.trim()) return
    setCreating(true)
    try {
      const project = await projectsApi.create(roomId, newName.trim(), newLang)
      setProjects((prev) => [project, ...prev])
      setShowCreate(false)
      setNewName('')
      toast.success('Project created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    try {
      await projectsApi.delete(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      toast.success('Project deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  const handleLeave = async () => {
    if (!roomId) return
    try {
      await roomsApi.leave(roomId)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave room')
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(roomId ?? '')
    toast.success('Room ID copied')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {/* Room header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white">{room?.name ?? 'Unnamed Room'}</h1>
            <button
              onClick={handleCopyId}
              className="text-zinc-500 text-xs font-mono mt-1 hover:text-zinc-300 transition-colors"
            >
              {roomId} · copy ID
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Project
            </button>
            {room?.ownerId !== user?.id && (
              <button
                onClick={handleLeave}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Leave
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Projects</h2>
            {projects.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
                <p className="text-3xl mb-2">📁</p>
                <p className="text-sm">No projects yet. Create one to start coding.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/workspace/${project.id}`)}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-left transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{langEmoji(project.language)}</span>
                      <div>
                        <p className="text-white font-medium group-hover:text-violet-400 transition-colors text-sm">
                          {project.name}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5 capitalize">{project.language} · v{project.version}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all p-1 rounded"
                      aria-label="Delete project"
                    >
                      ✕
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Members */}
          <div>
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Members ({room?.members.length ?? 0})
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              {room?.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3">
                  <UserAvatar email={m.user.email} size="sm" />
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{m.user.email}</p>
                    {m.user.id === room.ownerId && (
                      <p className="text-violet-400 text-xs">Owner</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-white font-semibold mb-4">New Project</h2>
            <div className="space-y-3 mb-4">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              />
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2.5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating || !newName.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {creating ? <Spinner size="sm" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function langEmoji(lang: string): string {
  const map: Record<string, string> = {
    javascript: '🟨', typescript: '🔷', python: '🐍',
    go: '🐹', rust: '🦀', cpp: '⚙️', java: '☕',
  }
  return map[lang] ?? '📄'
}
