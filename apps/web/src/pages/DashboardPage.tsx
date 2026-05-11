import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { roomsApi } from '../services/api'
import type { Room } from '../types'
import { Navbar } from '../components/Navbar'
import { Spinner } from '../components/Spinner'

export function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [joining, setJoining] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    roomsApi.myRooms()
      .then(setRooms)
      .catch(() => toast.error('Failed to load rooms'))
      .finally(() => setLoading(false))
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

  const handleJoin = async () => {
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

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-white">Your Rooms</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Room
          </button>
        </div>

        {/* Join by ID */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 flex gap-3">
          <input
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Paste a Room ID to join..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            onClick={handleJoin}
            disabled={joining || !joinId.trim()}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            {joining ? <Spinner size="sm" /> : 'Join'}
          </button>
        </div>

        {/* Create room modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-sm">
              <h2 className="text-white font-semibold mb-4">Create a Room</h2>
              <input
                autoFocus
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name (optional)"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm mb-4"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <div className="flex gap-3">
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
                  {creating ? <Spinner size="sm" /> : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rooms list */}
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <p className="text-4xl mb-3">🏠</p>
            <p>No rooms yet. Create one or join with an ID.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/rooms/${room.id}`)}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium group-hover:text-violet-400 transition-colors">
                      {room.name ?? 'Unnamed Room'}
                    </p>
                    <p className="text-zinc-500 text-xs mt-1 font-mono">{room.id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-zinc-400 text-sm">{room._count?.members ?? 0} members</p>
                    <p className="text-zinc-600 text-xs mt-1">
                      {new Date(room.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
