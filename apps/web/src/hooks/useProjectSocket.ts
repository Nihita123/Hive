import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { getSocket } from "../sockets/socket";
import { useEditorStore } from "../store/editorStore";
import { useAuthStore } from "../store/authStore";
import type {
  CodeSyncedPayload,
  VersionConflictPayload,
  CursorMovePayload,
  ExecutionCompletedPayload,
} from "../types";

export function useProjectSocket(projectId: string | undefined) {
  const socket = getSocket();
  const { user } = useAuthStore();
  const {
    applyRemoteSync,
    addActiveUser,
    removeActiveUser,
    setActiveUsers,
    setTyping,
    setRemoteCursor,
    removeRemoteCursor,
    setExecutionResult,
    setIsExecuting,
  } = useEditorStore();

  const joinedRef = useRef(false);

  useEffect(() => {
    if (!projectId || !socket) return;

    // ── Join the project room ──────────────────────────────────────────────
    socket.emit("join_project", { projectId });
    joinedRef.current = true;

    // ── joined_project ─────────────────────────────────────────────────────
    socket.on("joined_project", (payload) => {
      setActiveUsers(payload.activeUsers);
      // Sync latest code + version from server on join
      applyRemoteSync(payload.code, payload.version);
    });

    // ── code_synced ────────────────────────────────────────────────────────
    socket.on("code_synced", (payload: CodeSyncedPayload) => {
      if (payload.projectId !== projectId) return;
      setIsSaving(false);
      // Always sync the accepted project state, including for this client.
      // This ensures our local version increments after a successful save.
      applyRemoteSync(payload.code, payload.version);
    });

    // ── version_conflict ───────────────────────────────────────────────────
    socket.on("version_conflict", (payload: VersionConflictPayload) => {
      if (payload.projectId !== projectId) return;
      setIsSaving(false);
      toast.error("Version conflict — editor reset to latest version");
      applyRemoteSync(payload.serverCode, payload.serverVersion);
    });

    // ── user_joined ────────────────────────────────────────────────────────
    socket.on("user_joined", (payload) => {
      if (payload.projectId !== projectId) return;
      addActiveUser(payload.user);
      toast(`${payload.user.email} joined`, { icon: "👋", duration: 2000 });
    });

    // ── user_left ──────────────────────────────────────────────────────────
    socket.on("user_left", (payload) => {
      if (payload.projectId !== projectId) return;
      removeActiveUser(payload.userId);
      removeRemoteCursor(payload.userId);
    });

    // ── cursor_move ────────────────────────────────────────────────────────
    socket.on("cursor_move", (payload: CursorMovePayload) => {
      if (payload.projectId !== projectId) return;
      if (payload.userId === user?.id) return;
      const userEmail =
        useEditorStore
          .getState()
          .activeUsers.find((u) => u.id === payload.userId)?.email ??
        payload.userId;
      setRemoteCursor(payload.userId, userEmail, payload.cursorPosition);
    });

    // ── typing ─────────────────────────────────────────────────────────────
    socket.on("typing", (payload) => {
      if (payload.projectId !== projectId) return;
      if (payload.userId === user?.id) return;
      setTyping(payload.userId, true);
    });

    // ── execution_completed ────────────────────────────────────────────────
    socket.on("execution_completed", (payload: ExecutionCompletedPayload) => {
      if (payload.projectId !== projectId) return;
      setIsExecuting(false);
      setExecutionResult({
        jobId: payload.jobId,
        status: payload.status,
        output: payload.output,
        error: payload.error,
        exitCode: payload.exitCode,
        durationMs: payload.durationMs,
        timedOut: payload.timedOut,
      });
      if (payload.status === "completed") {
        toast.success("Execution completed");
      } else {
        toast.error("Execution failed");
      }
    });

    // ── error ──────────────────────────────────────────────────────────────
    socket.on("error", (payload) => {
      toast.error(payload.message);
    });

    return () => {
      if (joinedRef.current) {
        socket.emit("leave_project", { projectId });
        joinedRef.current = false;
      }
      socket.off("joined_project");
      socket.off("code_synced");
      socket.off("version_conflict");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("cursor_move");
      socket.off("typing");
      socket.off("execution_completed");
      socket.off("error");
    };
  }, [projectId, socket]);
}
