import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('token')
    socket = io('/', {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function connectSocket(): Socket {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
  socket = null
}

export function updateSocketToken(token: string) {
  // Reconnect with new token after login
  if (socket) {
    socket.auth = { token }
    if (socket.connected) {
      socket.disconnect()
      socket.connect()
    }
  }
}
