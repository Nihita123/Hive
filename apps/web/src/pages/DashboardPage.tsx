import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { roomsApi } from '../services/api'
import type { Room } from '../types'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'
import { Modal } from '../components/Modal'

type JoinTab = 'id' | 'invite'

export function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [joinTab, setJoinTab] = useState<JoinTab>('invite')
  const [joinId, setJoinId] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [joining, setJoining] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    roomsApi.myRooms()
      .then(setRooms)
      .catch(() => toast.error('Failed to load rooms'))
      .finally(() => setLoading(false))

    // Auto-fill invite code from URL param (e.g. /dashboard?invite=abc123)
    const inviteParam = searchParams.get('invite')
    if (inviteParam) {
      setInviteCode(inviteParam)
      setJoinTab('invite')
    }
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const room = await roomsApi.create(newRoomName.trim() || undefined)
      setRooms((prev) => [room, ...prev])
      setShowCreate(false)
      setNewRoomName('')
      toast.success('Room created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinById = async () => {
    if (!joinId.trim()) return
    setJoining(true)
    try {
      await roomsApi.join(joinId.trim())
      navigate(`/rooms/${joinId.trim()}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setJoining(false)
    }
  }

  const handleJoinByInvite = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    try {
      const { room } = await roomsApi.joinByInvite(inviteCode.trim())
      setRooms((prev) => {
        if (prev.some((r) => r.id === room.id)) return prev
        return [room, ...prev]
      })
      toast.success(`Joined "${room.name ?? 'room'}"`)
      navigate(`/rooms/${room.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid or expired invite code')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Your Rooms</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Collaborative coding workspaces</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> New Room
          </button>
        </div>

        {/* Join panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl mb-6 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setJoinTab('invite')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                joinTab === 'invite'
                  ? 'text-white border-b-2 border-violet-500 bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              🔗 Join by Invite Code
            </button>
            <button
              onClick={() => setJoinTab('id')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                joinTab === 'id'
                  ? 'text-white border-b-2 border-violet-500 bg-zinc-800/50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              # Join by Room ID
            </button>
          </div>

          <div className="p-4 flex gap-3">
            {joinTab === 'invite' ? (
              <>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Paste invite code..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinByInvite()}
                />
                <button
                  onClick={handleJoinByInvite}
                  disabled={joining || !inviteCode.trim()}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {joining ? <Spinner size="sm" /> : 'Join Room'}
                </button>
              </>
            ) : (
              <>
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Paste a Room ID..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinById()}
                />
                <button
                  onClick={handleJoinById}
                  disabled={joining || !joinId.trim()}
                  className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {joining ? <Spinner size="sm" /> : 'Join Room'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Rooms list */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-xl">
            <p className="text-4xl mb-3">🏠</p>
            <p className="font-medium text-zinc-400">No rooms yet</p>
            <p className="text-sm mt-1">Create a room or join one with an invite code.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 hover:bg-zinc-800/50 rounded-xl p-4 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm flex-shrink-0">
                      {(room.name ?? 'R').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium group-hover:text-violet-400 transition-colors truncate">
                        {room.name ?? 'Unnamed Room'}
                      </p>
                      <p className="text-zinc-600 text-xs mt-0.5 font-mono truncate">{room.id}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-zinc-400 text-sm">{room._count?.members ?? 0} members</p>
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {new Date(room.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Create room modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create a Room">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Room name</label>
            <input
              autoFocus
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. Backend Team, Hackathon..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <p className="text-zinc-600 text-xs mt-1">Optional — leave blank for an unnamed room</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {creating ? <Spinner size="sm" /> : 'Create Room'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
