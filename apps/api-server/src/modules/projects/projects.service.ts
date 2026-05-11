import { prisma } from "../../db/prisma";
import { conflict, notFound, forbidden } from "../../utils/errors";

// ─── Internal helpers ────────────────────────────────────────────────────────

async function assertRoomMembership(params: { roomId: string; userId: string }) {
  const membership = await prisma.roomMember.findUnique({
    where: {
      roomId_userId: { roomId: params.roomId, userId: params.userId },
    },
    select: { id: true },
  });
  if (!membership) throw notFound("Room not found");
}

// ─── Exported helpers ────────────────────────────────────────────────────────

/**
 * Verify a user has access to a project (is a member of its room).
 * Throws NOT_FOUND if the project doesn't exist or the user isn't a member.
 */
export async function assertProjectAccess(params: { projectId: string; userId: string }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, roomId: true },
  });
  if (!project) throw notFound("Project not found");
  await assertRoomMembership({ roomId: project.roomId, userId: params.userId });
}

// ─── Result types ────────────────────────────────────────────────────────────

export type UpdateCodeResult =
  | { ok: true; project: ProjectSnapshot }
  | { ok: false; conflict: { serverVersion: number; serverCode: string } };

export type ProjectSnapshot = {
  id: string;
  roomId: string;
  name: string;
  language: string;
  code: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Service functions ───────────────────────────────────────────────────────

export async function createProject(params: {
  roomId: string;
  userId: string;
  name: string;
  language: string;
  code?: string;
}): Promise<ProjectSnapshot> {
  await assertRoomMembership({ roomId: params.roomId, userId: params.userId });

  const project = await prisma.project.create({
    data: {
      roomId: params.roomId,
      name: params.name,
      language: params.language,
      code: params.code ?? "",
      version: 1,
    },
    select: {
      id: true,
      roomId: true,
      name: true,
      language: true,
      code: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return project;
}

/**
 * Atomically update a project's code using optimistic locking.
 *
 * The update is only applied when the incoming `version` matches the row's
 * current version in the database. If another writer has already incremented
 * the version, the conditional UPDATE matches 0 rows and we return the latest
 * server state so the caller can emit a version_conflict event.
 *
 * This avoids the read-check-write race condition that a plain
 * findUnique + update would have.
 */
export async function updateProjectCode(params: {
  projectId: string;
  userId: string;
  code: string;
  version: number;
}): Promise<UpdateCodeResult> {
  // 1. Verify the project exists and the user is a room member
  const current = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, roomId: true, version: true, code: true },
  });
  if (!current) throw notFound("Project not found");

  await assertRoomMembership({ roomId: current.roomId, userId: params.userId });

  // 2. Atomic conditional update — only touches the row when version still matches
  const result = await prisma.project.updateMany({
    where: {
      id: params.projectId,
      version: params.version, // optimistic lock condition
    },
    data: {
      code: params.code,
      version: { increment: 1 },
    },
  });

  // 3. If 0 rows were updated, a concurrent writer already incremented the version
  if (result.count === 0) {
    // Re-fetch the latest state to return to the caller
    const latest = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { version: true, code: true },
    });
    return {
      ok: false,
      conflict: {
        serverVersion: latest?.version ?? current.version,
        serverCode: latest?.code ?? current.code,
      },
    };
  }

  // 4. Fetch the updated row (updateMany doesn't return the record)
  const updated = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
    select: {
      id: true,
      roomId: true,
      name: true,
      language: true,
      code: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { ok: true, project: updated };
}

export async function fetchProject(params: {
  projectId: string;
  userId: string;
}): Promise<ProjectSnapshot> {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      id: true,
      roomId: true,
      name: true,
      language: true,
      code: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!project) throw notFound("Project not found");

  await assertRoomMembership({ roomId: project.roomId, userId: params.userId });
  return project;
}

export async function listRoomProjects(params: { roomId: string; userId: string }) {
  await assertRoomMembership({ roomId: params.roomId, userId: params.userId });

  const projects = await prisma.project.findMany({
    where: { roomId: params.roomId },
    select: {
      id: true,
      roomId: true,
      name: true,
      language: true,
      version: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return projects;
}

/**
 * Delete a project. Any room member may delete — restrict to owner if needed
 * by checking project.createdBy (not currently tracked in schema).
 */
export async function deleteProject(params: { projectId: string; userId: string }) {
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, roomId: true },
  });
  if (!project) throw notFound("Project not found");

  // Must be a room member to delete
  await assertRoomMembership({ roomId: project.roomId, userId: params.userId });

  await prisma.project.delete({ where: { id: params.projectId } });
  return { ok: true };
}
