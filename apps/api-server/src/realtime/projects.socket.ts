import { z } from "zod";
import type { Server, Socket } from "socket.io";
import { prisma } from "../db/prisma";
import { projectRoomId } from "./rooms";
import {
  addPresence,
  removePresence,
  removePresenceFromAll,
  getActiveUsers,
  isPresent,
} from "./presence";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketUser,
  CodeChangePayload,
  CursorMovePayload,
} from "./types";
import { updateProjectCode } from "../modules/projects/projects.service";

// ─── Validation schemas ──────────────────────────────────────────────────────

const joinLeaveSchema = z.object({ projectId: z.string().min(1) });

const codeChangeSchema = z.object({
  projectId: z.string().min(1),
  code: z.string(),
  version: z.number().int().min(1),
});

const cursorMoveSchema = z.object({
  projectId: z.string().min(1),
  cursorPosition: z.object({
    line: z.number().int().min(0),
    column: z.number().int().min(0),
  }),
});

const typingSchema = z.object({ projectId: z.string().min(1) });

// ─── Per-socket event throttle ───────────────────────────────────────────────

/**
 * Simple token-bucket throttle for high-frequency socket events.
 * Tracks the last emit timestamp per `socketId:event` key.
 * Returns true if the event should be allowed through.
 */
const throttleWindows = new Map<string, number>();

function throttle(socketId: string, event: string, minIntervalMs: number): boolean {
  const key = `${socketId}:${event}`;
  const last = throttleWindows.get(key) ?? 0;
  const now = Date.now();
  if (now - last < minIntervalMs) return false;
  throttleWindows.set(key, now);
  return true;
}

// Clean up stale throttle entries every 60 s to prevent memory growth
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, ts] of throttleWindows.entries()) {
    if (ts < cutoff) throttleWindows.delete(key);
  }
}, 60_000).unref();

// ─── Typing debounce ─────────────────────────────────────────────────────────

/**
 * Per-socket debounce timers for the "typing" event.
 * Key: `${socketId}:${projectId}`
 */
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TYPING_DEBOUNCE_MS = 500;

function scheduleTypingCleanup(key: string) {
  const existing = typingTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    typingTimers.delete(key);
  }, TYPING_DEBOUNCE_MS);
  typingTimers.set(key, timer);
}

function clearTypingTimers(socketId: string) {
  for (const key of typingTimers.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
    }
  }
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function assertProjectAccess(params: { projectId: string; userId: string }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, roomId: true, version: true, code: true },
  });
  if (!project) return null;

  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: project.roomId, userId: params.userId } },
    select: { id: true },
  });
  if (!member) return null;

  return project;
}

// ─── Handler registration ────────────────────────────────────────────────────

export function registerProjectSocketHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents> & { user: SocketUser },
) {
  // ── join_project ────────────────────────────────────────────────────────────
  socket.on("join_project", async (payload) => {
    const parsed = joinLeaveSchema.safeParse(payload);
    if (!parsed.success) return socket.emit("error", { message: "Invalid join_project payload" });

    const { projectId } = parsed.data;

    // Prevent duplicate joins from the same socket
    if (isPresent(projectId, socket.id)) {
      return socket.emit("error", { message: "Already joined this project" });
    }

    const project = await assertProjectAccess({ projectId, userId: socket.user.id });
    if (!project) return socket.emit("error", { message: "Project not found" });

    await socket.join(projectRoomId(project.id));

    const isNewUser = addPresence(project.id, socket.id, socket.user);
    const activeUsers = getActiveUsers(project.id);

    // Send the joining socket the current state: active users + latest version + code
    socket.emit("joined_project", {
      projectId: project.id,
      activeUsers,
      version: project.version,
      code: project.code,
    });

    // Notify others only when this is the user's first connection to this project
    if (isNewUser) {
      socket.to(projectRoomId(project.id)).emit("user_joined", {
        projectId: project.id,
        user: socket.user,
      });
    }
  });

  // ── leave_project ───────────────────────────────────────────────────────────
  socket.on("leave_project", async (payload) => {
    const parsed = joinLeaveSchema.safeParse(payload);
    if (!parsed.success) return socket.emit("error", { message: "Invalid leave_project payload" });

    const { projectId } = parsed.data;

    await socket.leave(projectRoomId(projectId));
    const wasPresent = removePresence(projectId, socket.id);

    socket.emit("left_project", { projectId });

    // Notify others only if the user has no remaining sockets in this project
    if (wasPresent && getActiveUsers(projectId).every((u) => u.id !== socket.user.id)) {
      socket.to(projectRoomId(projectId)).emit("user_left", {
        projectId,
        userId: socket.user.id,
      });
    }
  });

  // ── code_change ─────────────────────────────────────────────────────────────
  socket.on("code_change", async (payload: CodeChangePayload) => {
    // Throttle: max 1 code update per 100ms per socket
    if (!throttle(socket.id, "code_change", 100)) return;

    const parsed = codeChangeSchema.safeParse(payload);
    if (!parsed.success) return socket.emit("error", { message: "Invalid code_change payload" });

    const { projectId, code, version } = parsed.data;

    // Reuse the service layer — same atomic optimistic-lock logic as the HTTP path
    const result = await updateProjectCode({
      projectId,
      userId: socket.user.id,
      code,
      version,
    }).catch(() => null);

    if (!result) return socket.emit("error", { message: "Project not found" });

    if (!result.ok) {
      // Version mismatch — tell the sender to resync
      socket.emit("version_conflict", {
        projectId,
        serverVersion: result.conflict.serverVersion,
        serverCode: result.conflict.serverCode,
      });
      return;
    }

    // Broadcast the accepted update (including new version) to ALL sockets in the
    // project room — the sender included, so they can confirm their version bump.
    io.to(projectRoomId(projectId)).emit("code_synced", {
      projectId,
      code: result.project.code,
      version: result.project.version,
      userId: socket.user.id,
    });
  });

  // ── cursor_move ─────────────────────────────────────────────────────────────
  socket.on("cursor_move", async (payload: CursorMovePayload) => {
    // Throttle: max 1 cursor update per 50ms per socket (20 fps ceiling)
    if (!throttle(socket.id, "cursor_move", 50)) return;

    const parsed = cursorMoveSchema.safeParse(payload);
    if (!parsed.success) return socket.emit("error", { message: "Invalid cursor_move payload" });

    const { projectId, cursorPosition } = parsed.data;

    if (!isPresent(projectId, socket.id)) {
      return socket.emit("error", { message: "Join the project before sending cursor updates" });
    }

    socket.to(projectRoomId(projectId)).emit("cursor_move", {
      projectId,
      cursorPosition,
      userId: socket.user.id,
    });
  });

  // ── typing ──────────────────────────────────────────────────────────────────
  socket.on("typing", (payload) => {
    const parsed = typingSchema.safeParse(payload);
    if (!parsed.success) return socket.emit("error", { message: "Invalid typing payload" });

    const { projectId } = parsed.data;

    if (!isPresent(projectId, socket.id)) return;

    const debounceKey = `${socket.id}:${projectId}`;
    const isFirstEvent = !typingTimers.has(debounceKey);

    scheduleTypingCleanup(debounceKey);

    // Only broadcast on the leading edge to avoid flooding
    if (isFirstEvent) {
      socket.to(projectRoomId(projectId)).emit("typing", {
        projectId,
        userId: socket.user.id,
      });
    }
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    clearTypingTimers(socket.id);

    const affectedProjects = removePresenceFromAll(socket.id);

    for (const projectId of affectedProjects) {
      const stillActive = getActiveUsers(projectId).some((u) => u.id === socket.user.id);
      if (!stillActive) {
        io.to(projectRoomId(projectId)).emit("user_left", {
          projectId,
          userId: socket.user.id,
        });
      }
    }
  });
}
