import { useEffect, useRef, useCallback, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { toast } from "react-hot-toast"
import Editor, { type OnMount } from "@monaco-editor/react"
import type * as Monaco from "monaco-editor"
import { projectsApi, executionApi } from "../services/api"
import { useEditorStore } from "../store/editorStore"
import { useAuthStore } from "../store/authStore"
import { useProjectSocket } from "../hooks/useProjectSocket"
import { getSocket } from "../sockets/socket"
import { Spinner } from "../components/Spinner"
import { UserAvatar } from "../components/UserAvatar"
import type { Project } from "../types"

const MONACO_LANG: Record<string, string> = {
  javascript: "javascript", typescript: "typescript",
  python: "python", go: "go", rust: "rust", cpp: "cpp", java: "java",
}

function langEmoji(lang: string): string {
  const map: Record<string, string> = {
    javascript: "🟨", typescript: "🔷", python: "🐍",
    go: "🐹", rust: "🦀", cpp: "⚙️", java: "☕",
  }
  return map[lang] ?? "📄"
}

export function WorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const socket = getSocket()

  const {
    project, localCode, localVersion,
    activeUsers, typingUsers, remoteCursors,
    executionResult, isExecuting, isSaving,
    setProject, setLocalCode, setIsExecuting, setExecutionResult,
    setIsSaving, reset,
  } = useEditorStore()

  const [syncedFlash, setSyncedFlash] = useState(false)
  const [roomProjects, setRoomProjects] = useState<Project[]>([])
  const [sidebarTab, setSidebarTab] = useState<"online" | "info">("online")

  const syncFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)
  const pendingCodeRef = useRef<string | null>(null)
  const isSavingRef = useRef(false)

  useProjectSocket(projectId)

  useEffect(() => { isSavingRef.current = isSaving }, [isSaving])

  // Flash "synced" on version increment
  const prevVersionRef = useRef(localVersion)
  useEffect(() => {
    if (localVersion !== prevVersionRef.current) {
      prevVersionRef.current = localVersion
      setSyncedFlash(true)
      if (syncFlashTimer.current) clearTimeout(syncFlashTimer.current)
      syncFlashTimer.current = setTimeout(() => setSyncedFlash(false), 1500)
    }
  }, [localVersion])

  // Load project + sibling projects for the switcher
  useEffect(() => {
    if (!projectId) return
    reset()
    projectsApi.get(projectId)
      .then((p) => {
        setProject(p)
        return projectsApi.list(p.roomId)
      })
      .then(setRoomProjects)
      .catch(() => { toast.error("Project not found"); navigate(-1) })
    return () => {
      if (syncFlashTimer.current) clearTimeout(syncFlashTimer.current)
      reset()
    }
  }, [projectId])

  // Remote cursor decorations
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const decorations: Monaco.editor.IModelDeltaDecoration[] = []
    remoteCursors.forEach((cursor) => {
      decorations.push({
        range: {
          startLineNumber: cursor.position.line + 1,
          startColumn: cursor.position.column + 1,
          endLineNumber: cursor.position.line + 1,
          endColumn: cursor.position.column + 2,
        },
        options: { className: "remote-cursor", hoverMessage: { value: cursor.email } },
      })
    })
    if (decorationsRef.current) decorationsRef.current.set(decorations)
    else decorationsRef.current = editor.createDecorationsCollection(decorations)
  }, [remoteCursors])

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.onDidChangeCursorPosition((e) => {
      if (!projectId) return
      socket.emit("cursor_move", {
        projectId,
        cursorPosition: { line: e.position.lineNumber - 1, column: e.position.column - 1 },
      })
    })
  }

  const flushPendingCode = useCallback(() => {
    if (!projectId) return
    const pending = pendingCodeRef.current
    if (pending === null) return
    pendingCodeRef.current = null
    setIsSaving(true)
    socket.emit("code_change", {
      projectId,
      code: pending,
      version: useEditorStore.getState().localVersion,
    })
  }, [projectId, setIsSaving, socket])

  const handleCodeChange = useCallback((value: string | undefined) => {
    const code = value ?? ""
    setLocalCode(code)
    pendingCodeRef.current = code
    if (!projectId) return
    socket.emit("typing", { projectId })
    if (!isSavingRef.current) flushPendingCode()
  }, [projectId, socket, flushPendingCode])

  useEffect(() => {
    if (!isSaving && pendingCodeRef.current !== null) flushPendingCode()
  }, [isSaving, flushPendingCode])

  const handleRun = async () => {
    if (!project || !projectId) return
    setIsExecuting(true)
    setExecutionResult(null)
    try {
      const { jobId } = await executionApi.run(projectId, project.language, localCode)
      toast("Job queued", { icon: "⚡", duration: 2000 })
      const poll = async (attempts = 0): Promise<void> => {
        if (attempts > 25) { setIsExecuting(false); return }
        const result = await executionApi.status(jobId)
        if (result.status === "queued" || result.status === "running") {
          await new Promise((r) => setTimeout(r, 800))
          return poll(attempts + 1)
        }
        if (useEditorStore.getState().isExecuting) {
          setExecutionResult(result)
          setIsExecuting(false)
        }
      }
      setTimeout(() => { if (useEditorStore.getState().isExecuting) void poll() }, 1500)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Execution failed")
      setIsExecuting(false)
    }
  }

  const typingUsersList = activeUsers.filter((u) => u.id !== user?.id && typingUsers.has(u.id))

  if (!project) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-4 gap-3 flex-shrink-0">
        <Link
          to={`/rooms/${project.roomId}`}
          className="text-zinc-500 hover:text-white transition-colors text-sm flex-shrink-0"
        >
          ← Back
        </Link>
        <span className="text-zinc-700">|</span>
        <span className="text-base flex-shrink-0">{langEmoji(project.language)}</span>
        <span className="text-white text-sm font-medium truncate">{project.name}</span>
        <span className="text-zinc-600 text-xs capitalize bg-zinc-800 px-2 py-0.5 rounded flex-shrink-0">
          {project.language}
        </span>
        <span className="text-zinc-600 text-xs flex-shrink-0">v{localVersion}</span>
        <span
          className={`text-xs transition-opacity duration-500 flex-shrink-0 ${
            syncedFlash ? "text-emerald-400 opacity-100" : "opacity-0"
          }`}
        >
          ✓ synced
        </span>
        <div className="flex-1" />
        {/* Active user avatars */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeUsers.slice(0, 4).map((u) => (
            <UserAvatar key={u.id} email={u.email} size="sm" isTyping={typingUsers.has(u.id)} />
          ))}
          {activeUsers.length > 4 && (
            <span className="text-zinc-500 text-xs ml-1">+{activeUsers.length - 4}</span>
          )}
        </div>
        <button
          onClick={handleRun}
          disabled={isExecuting}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 flex-shrink-0"
        >
          {isExecuting ? <><Spinner size="sm" /> Running…</> : "▶ Run"}
        </button>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar: project switcher ───────────────────────────────── */}
        <aside className="w-44 border-r border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Files</p>
            <Link
              to={`/rooms/${project.roomId}`}
              className="text-zinc-700 hover:text-zinc-400 text-xs transition-colors"
              title="Back to room"
            >
              ⚙
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {roomProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => p.id !== projectId && navigate(`/workspace/${p.id}`)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors text-xs ${
                  p.id === projectId
                    ? "bg-violet-600/20 text-violet-300 border-r-2 border-violet-500"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
              >
                <span className="flex-shrink-0 text-sm">{langEmoji(p.language)}</span>
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            {roomProjects.length === 0 && (
              <p className="text-zinc-700 text-xs px-3 py-2">No projects</p>
            )}
          </div>
        </aside>

        {/* ── Monaco Editor ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={MONACO_LANG[project.language] ?? "plaintext"}
            value={localCode}
            onChange={handleCodeChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 14,
              fontFamily: '"ui-monospace", "Cascadia Code", Consolas, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              renderLineHighlight: "line",
              padding: { top: 12 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              tabSize: 2,
              wordWrap: "off",
            }}
          />
        </div>

        {/* ── Right sidebar: presence + info ───────────────────────────────── */}
        <aside className="w-48 border-l border-zinc-800 bg-zinc-900 flex flex-col flex-shrink-0 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setSidebarTab("online")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sidebarTab === "online" ? "text-white bg-zinc-800/50" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Online · {activeUsers.length}
            </button>
            <button
              onClick={() => setSidebarTab("info")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                sidebarTab === "info" ? "text-white bg-zinc-800/50" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Info
            </button>
          </div>

          {sidebarTab === "online" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {activeUsers.length === 0 ? (
                <p className="text-zinc-600 text-xs pt-1">No one else here yet</p>
              ) : (
                activeUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <UserAvatar email={u.email} size="sm" isTyping={typingUsers.has(u.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-zinc-200 text-xs truncate">{u.email.split("@")[0]}</p>
                      {u.id === user?.id
                        ? <p className="text-zinc-600 text-xs">you</p>
                        : typingUsers.has(u.id) && <p className="text-emerald-400 text-xs">typing…</p>
                      }
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              <div>
                <p className="text-zinc-600 text-xs mb-1 uppercase tracking-wider">Project</p>
                <p className="text-white text-xs font-medium">{project.name}</p>
              </div>
              <div>
                <p className="text-zinc-600 text-xs mb-1 uppercase tracking-wider">Language</p>
                <p className="text-zinc-300 text-xs capitalize">{project.language}</p>
              </div>
              <div>
                <p className="text-zinc-600 text-xs mb-1 uppercase tracking-wider">Version</p>
                <p className="text-zinc-300 text-xs">v{localVersion}</p>
              </div>
              <div>
                <p className="text-zinc-600 text-xs mb-1 uppercase tracking-wider">Collaborators</p>
                <p className="text-zinc-300 text-xs">{activeUsers.length} online</p>
              </div>
            </div>
          )}

          {/* Typing banner */}
          {typingUsersList.length > 0 && (
            <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-950/50">
              <p className="text-emerald-400 text-xs truncate">
                ✎ {typingUsersList.map((u) => u.email.split("@")[0]).join(", ")} typing…
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* ── Output console ───────────────────────────────────────────────────── */}
      <div className="h-44 border-t border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 flex-shrink-0">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Console</span>
          {executionResult && (
            <div className="flex items-center gap-3 text-xs">
              <span
                className={
                  executionResult.timedOut ? "text-amber-400"
                  : executionResult.exitCode === 0 ? "text-emerald-400"
                  : "text-rose-400"
                }
              >
                {executionResult.timedOut ? "⏱ Timed out" : `Exit ${executionResult.exitCode ?? "?"}`}
              </span>
              {executionResult.durationMs !== undefined && (
                <span className="text-zinc-500">{executionResult.durationMs}ms</span>
              )}
              <button
                onClick={() => setExecutionResult(null)}
                className="text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                aria-label="Clear output"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-sm">
          {isExecuting && !executionResult && (
            <div className="flex items-center gap-2 text-zinc-500">
              <Spinner size="sm" /><span>Executing…</span>
            </div>
          )}
          {executionResult?.output && (
            <pre className="text-emerald-300 whitespace-pre-wrap leading-relaxed">{executionResult.output}</pre>
          )}
          {executionResult?.error && (
            <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed mt-1">{executionResult.error}</pre>
          )}
          {!isExecuting && !executionResult && (
            <span className="text-zinc-600 select-none">
              Press <span className="text-zinc-400">▶ Run</span> to execute
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
