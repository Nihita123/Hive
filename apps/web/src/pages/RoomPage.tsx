import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { roomsApi, projectsApi } from '../services/api'
import type { RoomDetails, Project, RoomInvite } from '../types'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { UserAvatar } from '../components/UserAvatar'
import { Modal } from '../components/Modal'
import { useAuthStore } from '../store/authStore'

const LANGUAGES = [
  { value: 'javascript', label: '🟨 JavaScript' },
  { value: 'python',     label: '🐍 Python' },
  { value: 'typescript', label: '🔷 TypeScript' },
  { value: 'go',         label: '🐹 Go' },
  { value: 'rust',       label: '🦀 Rust' },
  { value: 'cpp',        label: '⚙️ C++' },
  { value: 'java',       label: '☕ Java' },
]

function langEmoji(lang: string): string {
  const map: Record<string, string> = {
    javascript: '🟨', typescript: '🔷', python: '🐍',
    go: '🐹', rust: '🦀', cpp: '⚙️', java: '☕',
  }
  return map[lang] ?? '📄'
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [room, setRoom] = useState<RoomDetails | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showDeleteRoom, setShowDeleteRoom] = useState(false)

  // Create project form
  const [newName, setNewName] = useState('')
  const [newLang, setNewLang] = useState('javascript')
  const [creating, setCreating] = useState(false)

  // Invite
  const [invite, setInvite] = useState<RoomInvite | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  // Delete room
  const [deletingRoom, setDeletingRoom] = useState(false)

  const isOwner = room?.ownerId === user?.id

  useEffect(() => {
    if (!roomId) return
    Promise.all([roomsApi.details(roomId), projectsApi.list(roomId)])
      .then(([r, p]) => { setRoom(r); setProjects(p) })
      .catch(() => { toast.error('Failed to load room'); navigate('/dashboard') })
      .finally(() => setLoading(false))
  }, [roomId])

  // ── Project actions ──────────────────────────────────────────────────────────

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
    try {
      await projectsApi.delete(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
      toast.success('Project deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete project')
    }
  }

  // ── Room actions ─────────────────────────────────────────────────────────────

  const handleLeave = async () => {
    if (!roomId) return
    try {
      await roomsApi.leave(roomId)
      navigate('/dashboard')
      toast.success('Left room')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave room')
    }
  }

  const handleDeleteRoom = async () => {
    if (!roomId) return
    setDeletingRoom(true)
    try {
      await roomsApi.delete(roomId)
      navigate('/dashboard')
      toast.success('Room deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete room')
    } finally {
      setDeletingRoom(false)
    }
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(roomId ?? '')
    toast.success('Room ID copied')
  }

  // ── Invite actions ───────────────────────────────────────────────────────────

  const handleGenerateInvite = async () => {
    if (!roomId) return
    setGeneratingInvite(true)
    try {
      const inv = await roomsApi.createInvite(roomId)
      setInvite(inv)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate invite')
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleCopyInviteCode = () => {
    if (!invite) return
    navigator.clipboard.writeText(invite.code)
    toast.success('Invite code copied!')
  }

  const handleCopyInviteLink = () => {
    if (!invite) return
    const link = `${window.location.origin}/dashboard?invite=${invite.code}`
    navigator.clipboard.writeText(link)
    toast.success('Invite link copied!')
  }

  // ── Loading state ────────────────────────────────────────────────────────────

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

        {/* ── Room header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold flex-shrink-0">
                {(room?.name ?? 'R').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-white truncate">
                  {room?.name ?? 'Unnamed Room'}
                </h1>
                <button
                  onClick={handleCopyId}
                  className="text-zinc-600 text-xs font-mono hover:text-zinc-400 transition-colors flex items-center gap-1 mt-0.5"
                >
                  {roomId}
                  <span className="text-zinc-700">· copy</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Invite button */}
            <button
              onClick={() => { setShowInvite(true); if (!invite) handleGenerateInvite() }}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700"
            >
              🔗 Invite
            </button>

            {/* New project */}
            <button
              onClick={() => setShowCreate(true)}
              className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Project
            </button>

            {/* Owner actions */}
            {isOwner ? (
              <button
                onClick={() => setShowDeleteRoom(true)}
                className="bg-zinc-800 hover:bg-rose-900/50 hover:border-rose-700 text-zinc-400 hover:text-rose-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700"
                title="Delete room"
              >
                🗑
              </button>
            ) : (
              <button
                onClick={handleLeave}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700"
              >
                Leave
              </button>
            )}
          </div>
        </div>

        {/* ── Main grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Projects — 2/3 width */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Projects · {projects.length}
              </h2>
            </div>

            {projects.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 border-dashed rounded-xl p-10 text-center">
                <p className="text-3xl mb-3">📁</p>
                <p className="text-zinc-400 font-medium text-sm">No projects yet</p>
                <p className="text-zinc-600 text-xs mt-1">Create a project to start coding together</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                >
                  + Create Project
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigate(`/workspace/${project.id}`)}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-violet-500/40 hover:bg-zinc-800/50 rounded-xl p-4 text-left transition-all group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl flex-shrink-0">{langEmoji(project.language)}</span>
                      <div className="min-w-0">
                        <p className="text-white font-medium group-hover:text-violet-400 transition-colors text-sm truncate">
                          {project.name}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5 capitalize">
                          {project.language} · v{project.version} · {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-all p-1.5 rounded hover:bg-rose-400/10 flex-shrink-0 ml-2"
                      aria-label="Delete project"
                    >
                      🗑
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Members — 1/3 width */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Members · {room?.members.length ?? 0}
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {room?.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar email={m.user.email} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{m.user.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.user.id === room.ownerId && (
                        <span className="text-violet-400 text-xs bg-violet-400/10 px-1.5 py-0.5 rounded">Owner</span>
                      )}
                      {m.user.id === user?.id && (
                        <span className="text-zinc-600 text-xs">you</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* ── Create project modal ─────────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Project">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Project name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. API Server, Data Pipeline..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Language</label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setNewLang(l.value)}
                  className={`px-3 py-2 rounded-lg text-sm text-left transition-colors border ${
                    newLang === l.value
                      ? 'bg-violet-600/20 border-violet-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
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
              {creating ? <Spinner size="sm" /> : 'Create Project'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Invite modal ─────────────────────────────────────────────────────── */}
      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite to Room">
        <div className="space-y-4">
          {generatingInvite ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="md" />
            </div>
          ) : invite ? (
            <>
              <div>
                <p className="text-xs text-zinc-400 mb-2">Invite code</p>
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5">
                  <code className="flex-1 text-violet-300 text-sm font-mono tracking-wider">
                    {invite.code}
                  </code>
                  <button
                    onClick={handleCopyInviteCode}
                    className="text-zinc-400 hover:text-white transition-colors text-xs bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-2">Or share the full link</p>
                <button
                  onClick={handleCopyInviteLink}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm py-2.5 rounded-lg transition-colors"
                >
                  🔗 Copy Invite Link
                </button>
              </div>

              <div className="bg-zinc-800/50 rounded-lg px-3 py-2.5 flex items-center justify-between text-xs text-zinc-500">
                <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                <span>{invite.usedCount} / {invite.maxUses} uses</span>
              </div>

              <button
                onClick={handleGenerateInvite}
                className="w-full text-zinc-500 hover:text-zinc-300 text-xs transition-colors py-1"
              >
                Generate new code
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-zinc-500 text-sm mb-3">Generate an invite link to share this room</p>
              <button
                onClick={handleGenerateInvite}
                className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-colors"
              >
                Generate Invite
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete room confirm ───────────────────────────────────────────────── */}
      <Modal open={showDeleteRoom} onClose={() => setShowDeleteRoom(false)} title="Delete Room">
        <div className="space-y-4">
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3">
            <p className="text-rose-400 text-sm font-medium">This action cannot be undone</p>
            <p className="text-zinc-400 text-xs mt-1">
              Deleting <span className="text-white font-medium">"{room?.name ?? 'this room'}"</span> will
              permanently remove all projects, code, and members.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteRoom(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteRoom}
              disabled={deletingRoom}
              className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {deletingRoom ? <Spinner size="sm" /> : 'Delete Room'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
