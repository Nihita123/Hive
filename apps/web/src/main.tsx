import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { connectSocket } from './sockets/socket.ts'

// If the user is already authenticated (token in localStorage from a previous
// session), connect the socket immediately so presence works on page refresh.
if (localStorage.getItem('token')) {
  connectSocket()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
