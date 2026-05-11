import type { SocketUser } from "./types";

/**
 * In-memory presence store.
 *
 * Structure:
 *   projectPresence: projectId → Map<socketId, SocketUser>
 *
 * A single user can have multiple socket connections (e.g. two browser tabs),
 * so we key by socketId rather than userId.
 */
const projectPresence = new Map<string, Map<string, SocketUser>>();

/** Add a socket to a project's presence list. Returns false if already present. */
export function addPresence(projectId: string, socketId: string, user: SocketUser): boolean {
  if (!projectPresence.has(projectId)) {
    projectPresence.set(projectId, new Map());
  }
  const room = projectPresence.get(projectId)!;
  if (room.has(socketId)) return false;
  room.set(socketId, user);
  return true;
}

/** Remove a socket from a project's presence list. Returns true if it was present. */
export function removePresence(projectId: string, socketId: string): boolean {
  const room = projectPresence.get(projectId);
  if (!room) return false;
  const existed = room.delete(socketId);
  if (room.size === 0) projectPresence.delete(projectId);
  return existed;
}

/**
 * Remove a socket from ALL projects it was present in.
 * Returns the list of projectIds it was removed from.
 */
export function removePresenceFromAll(socketId: string): string[] {
  const affected: string[] = [];
  for (const [projectId, room] of projectPresence.entries()) {
    if (room.delete(socketId)) {
      affected.push(projectId);
      if (room.size === 0) projectPresence.delete(projectId);
    }
  }
  return affected;
}

/** Get all unique users currently present in a project (deduplicated by userId). */
export function getActiveUsers(projectId: string): SocketUser[] {
  const room = projectPresence.get(projectId);
  if (!room) return [];

  // Deduplicate: a user with two tabs should appear only once
  const seen = new Map<string, SocketUser>();
  for (const user of room.values()) {
    if (!seen.has(user.id)) seen.set(user.id, user);
  }
  return Array.from(seen.values());
}

/** Check whether a specific socket is already tracked in a project. */
export function isPresent(projectId: string, socketId: string): boolean {
  return projectPresence.get(projectId)?.has(socketId) ?? false;
}
