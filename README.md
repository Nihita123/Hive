# 🐝 Hive — Real-Time Collaborative Code Editor

Hive is a **real-time collaborative code editor** that lets multiple users write, edit, and execute code together — like Google Docs, but for developers.

---

## ✨ Features

- 🧑‍💻 Real-time collaborative editing with live sync
- 👀 Live cursor tracking & typing indicators
- ⚡ Conflict resolution via optimistic locking
- ▶️ Secure sandboxed code execution using Docker
- 🏢 Room-based team workspaces
- 🔐 JWT authentication with bcrypt
- 📡 WebSocket-based real-time communication
- 📊 Execution output with exit code & duration

---

## 🏗️ Architecture Overview

```
Browser (React + Monaco Editor)
        ↓ HTTP (Axios) + WebSocket (Socket.IO)
API Server (Express + TypeScript)
        ↓
PostgreSQL (Prisma ORM) + Redis (BullMQ + Pub/Sub)
        ↓
Worker Process (Docker container execution)
```

---

## 🧠 Tech Stack

### Frontend
- React 19 + Vite
- TypeScript
- Tailwind CSS v4
- Zustand (state management)
- Monaco Editor (VS Code engine)
- Socket.IO Client

### Backend
- Node.js + Express.js
- TypeScript
- Prisma ORM + PostgreSQL

### Real-Time & Queue
- Socket.IO + Redis adapter
- BullMQ (job queue)
- Redis Pub/Sub

### Execution
- Docker (isolated sandboxed containers)

---

## 🔐 Authentication

- Passwords hashed with **bcrypt** (12 rounds)
- JWT `{ sub, email }` — expires in 7 days
- `requireAuth` middleware protects all routes
- Token stored in `localStorage`, attached via Axios interceptor

---

## 🏢 Rooms & Projects

### Rooms
- Create / Join / Leave rooms
- Invite users via time-limited codes (48h TTL, 100 max uses)
- Owner & member roles — owner cannot leave
- Non-members receive `404` (not `403`) to prevent existence leaks

### Projects
- Each room holds multiple projects
- Supports multiple languages (Node.js, Python)
- Version field tracks every change for conflict detection

---

## ⚠️ Conflict Resolution

Hive uses **Optimistic Locking** to prevent two users from overwriting each other during simultaneous edits.

### How it works
- Every project has a `version` number
- Code updates only succeed if the sent version still matches the DB
- If there's a mismatch → conflict detected atomically

### SQL logic
```sql
UPDATE Project
SET code = ?, version = version + 1
WHERE id = ? AND version = ?
```

On conflict → HTTP returns `409 VERSION_CONFLICT` · Socket emits `version_conflict` · Client resets to server state

---

## 📡 Real-Time System

Powered by **Socket.IO** with a Redis adapter for multi-instance support.

### Events

**Client → Server**
- `join_project`
- `leave_project`
- `code_change { code, version }`
- `cursor_move`
- `typing`

**Server → Client**
- `joined_project`
- `code_synced`
- `version_conflict`
- `user_joined` / `user_left`
- `cursor_move` / `typing`
- `execution_completed`
- `error`

---

## ⚙️ Code Execution System

### Flow
1. User clicks ▶ Run
2. `POST /api/execute` → job added to Redis queue → returns `{ jobId }` immediately
3. Worker picks up the job
4. Docker container spins up and runs the code
5. Output captured from container logs
6. Result published via Redis Pub/Sub → Socket.IO → all users see output

### 🐳 Docker Security
- ❌ No internet access (`NetworkDisabled: true`)
- ❌ No Linux capabilities (`CapDrop: ALL`)
- ❌ No privilege escalation
- ⏱️ 10-second hard timeout
- 🧠 128 MB memory limit
- ⚡ 50% CPU cap
- 📄 100 KB output cap

---

## 🧵 State Management (Frontend)

### Auth Store *(persisted to localStorage)*
- User info & JWT token
- `setAuth` → connects socket · `clearAuth` → disconnects socket

### Editor Store *(in-memory)*
- Current code & version
- Active users & remote cursors
- Typing indicators
- Execution results & loading state

---

## 🔄 Code Sync Optimization

Instead of sending every keystroke to the server:

- Changes are applied locally **instantly** (no lag)
- Latest code is buffered in a ref
- Only **one request in-flight** at a time
- When a response arrives, buffered changes are flushed next

✔ Prevents race conditions &nbsp; ✔ Reduces server load

---

## 🛡️ Middleware

- **Rate limiting** — auth: 20 req/15 min · execution: 10 req/min · general: 200 req/min
- **Error handling** — all errors normalized to `{ error, message, details }`
- **Request logging** — `[HTTP] INFO POST /api/auth/login → 200 (43ms)`
- **Input validation** — Zod schemas on all request bodies

---

## ▶️ Getting Started

### Prerequisites
- Node.js
- Docker
- PostgreSQL
- Redis

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/hive.git
cd hive
```

### 2. Configure Environment
Create `apps/api-server/.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5433/hive
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-here
PORT=5000
```

### 3. Start Redis
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Start the Backend
```bash
cd apps/api-server
npm install
npm run dev
```

### 5. Start the Worker
```bash
# in apps/api-server (separate terminal)
npm run worker
```

### 6. Start the Frontend
```bash
cd apps/web
npm install
npm run dev
```

---

## 🌐 Ports

| Service | Port |
|---------|------|
| Frontend | 3001 |
| Backend API | 5000 |
| Redis | 6379 |
| PostgreSQL | 5433 |

> Vite proxies `/api` and `/socket.io` to `localhost:5000` — no CORS setup needed.
