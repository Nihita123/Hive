export type SocketUser = {
  id: string;
  email: string;
};

export type JoinProjectPayload = {
  projectId: string;
};

export type LeaveProjectPayload = {
  projectId: string;
};

export type CodeChangePayload = {
  projectId: string;
  code: string;
  /** Client's current version — must match server version for the update to apply */
  version: number;
};

export type CursorPosition = {
  /** Line number (0-indexed) */
  line: number;
  /** Column / character offset (0-indexed) */
  column: number;
};

export type CursorMovePayload = {
  projectId: string;
  cursorPosition: CursorPosition;
};

export type TypingPayload = {
  projectId: string;
};

// ─── Server → Client ────────────────────────────────────────────────────────

export type ServerToClientEvents = {
  /**
   * Successful code update — broadcast to all users in the project room
   * (including the sender, so they can confirm the new version).
   */
  code_synced: (payload: {
    projectId: string;
    code: string;
    version: number;
    userId: string;
  }) => void;

  /**
   * Sent only to the socket whose update was rejected due to a version mismatch.
   * Contains the latest server state so the client can resync.
   */
  version_conflict: (payload: {
    projectId: string;
    serverVersion: number;
    serverCode: string;
  }) => void;

  /** Confirmation that the current socket joined a project session */
  joined_project: (payload: {
    projectId: string;
    activeUsers: SocketUser[];
    version: number;
    code: string;
  }) => void;

  /** Confirmation that the current socket left a project session */
  left_project: (payload: { projectId: string }) => void;

  /** A user (other than self) joined the project session */
  user_joined: (payload: { projectId: string; user: SocketUser }) => void;

  /** A user left (or disconnected from) the project session */
  user_left: (payload: { projectId: string; userId: string }) => void;

  /** Another user moved their cursor */
  cursor_move: (payload: CursorMovePayload & { userId: string }) => void;

  /** Another user is actively typing */
  typing: (payload: { projectId: string; userId: string }) => void;

  /** A code execution job finished — emitted to all users in the project room */
  execution_completed: (payload: {
    jobId: string;
    projectId: string;
    status: "completed" | "failed";
    output: string;
    error: string;
    exitCode: number | null;
    durationMs: number;
    timedOut: boolean;
  }) => void;

  error: (payload: { message: string }) => void;
};

// ─── Client → Server ────────────────────────────────────────────────────────

export type ClientToServerEvents = {
  join_project: (payload: JoinProjectPayload) => void;
  leave_project: (payload: LeaveProjectPayload) => void;
  /** Must include the client's current version for optimistic locking */
  code_change: (payload: CodeChangePayload) => void;
  cursor_move: (payload: CursorMovePayload) => void;
  typing: (payload: TypingPayload) => void;
};
