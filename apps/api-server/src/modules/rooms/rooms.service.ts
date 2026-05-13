import { prisma } from "../../db/prisma";
import { conflict, notFound, forbidden, badRequest } from "../../utils/errors";
import crypto from "crypto";

export async function createRoom(params: { ownerId: string; name?: string | null }) {
  const room = await prisma.room.create({
    data: {
      name: params.name ?? null,
      ownerId: params.ownerId,
      members: {
        create: { userId: params.ownerId },
      },
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
    },
  });

  return room;
}

export async function joinRoom(params: { roomId: string; userId: string }) {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: { id: true },
  });
  if (!room) throw notFound("Room not found");

  try {
    await prisma.roomMember.create({
      data: { roomId: params.roomId, userId: params.userId },
    });
  } catch (e) {
    // Unique constraint (already a member) will be mapped by errorHandler too,
    // but we return a cleaner message here.
    throw conflict("User already in room");
  }

  return { ok: true };
}

export async function leaveRoom(params: { roomId: string; userId: string }) {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) throw notFound("Room not found");

  // Owner must remain a member (can be changed later via transfer ownership feature)
  if (room.ownerId === params.userId) throw conflict("Room owner cannot leave the room");

  await prisma.roomMember.deleteMany({
    where: { roomId: params.roomId, userId: params.userId },
  });

  return { ok: true };
}

export async function getRoomDetails(params: { roomId: string; userId: string }) {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
      members: {
        select: {
          user: { select: { id: true, email: true } },
          joinedAt: true,
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!room) throw notFound("Room not found");

  const isMember = room.members.some((m: { user: { id: string } }) => m.user.id === params.userId);
  if (!isMember) throw notFound("Room not found");

  return room;
}

export async function listMyRooms(params: { userId: string }) {
  const rooms = await prisma.room.findMany({
    where: { members: { some: { userId: params.userId } } },
    select: {
      id: true,
      name: true,
      ownerId: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rooms;
}

export async function deleteRoom(params: { roomId: string; userId: string }) {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.ownerId !== params.userId) throw forbidden("Only the room owner can delete this room");

  // Cascade deletes RoomMember + Project rows via DB foreign key constraints
  await prisma.room.delete({ where: { id: params.roomId } });
  return { ok: true };
}

// ─── Ownership transfer ───────────────────────────────────────────────────────

export async function transferOwnership(params: {
  roomId: string;
  currentOwnerId: string;
  newOwnerId: string;
}) {
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: { id: true, ownerId: true },
  });
  if (!room) throw notFound("Room not found");
  if (room.ownerId !== params.currentOwnerId) {
    throw forbidden("Only the current owner can transfer ownership");
  }
  if (params.currentOwnerId === params.newOwnerId) {
    throw badRequest("You are already the owner");
  }

  // Target must already be a member
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.roomId, userId: params.newOwnerId } },
    select: { id: true },
  });
  if (!membership) throw badRequest("Target user is not a member of this room");

  const updated = await prisma.room.update({
    where: { id: params.roomId },
    data: { ownerId: params.newOwnerId },
    select: { id: true, name: true, ownerId: true, createdAt: true },
  });

  return { room: updated };
}

// ─── Invite system ────────────────────────────────────────────────────────────

const INVITE_TTL_HOURS = 48;

export async function createInvite(params: { roomId: string; userId: string }) {
  // Only room members can create invites
  const room = await prisma.room.findUnique({
    where: { id: params.roomId },
    select: { id: true },
  });
  if (!room) throw notFound("Room not found");

  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: params.roomId, userId: params.userId } },
    select: { id: true },
  });
  if (!membership) throw forbidden("You must be a room member to create an invite");

  const code = crypto.randomBytes(12).toString("base64url"); // 16-char URL-safe code
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const invite = await prisma.roomInvite.create({
    data: {
      roomId: params.roomId,
      createdBy: params.userId,
      code,
      expiresAt,
    },
    select: {
      id: true,
      code: true,
      roomId: true,
      expiresAt: true,
      maxUses: true,
      usedCount: true,
    },
  });

  return invite;
}

export async function joinByInvite(params: { code: string; userId: string }) {
  const invite = await prisma.roomInvite.findUnique({
    where: { code: params.code },
    select: {
      id: true,
      roomId: true,
      expiresAt: true,
      usedCount: true,
      maxUses: true,
    },
  });

  if (!invite) throw notFound("Invite code not found or already expired");
  if (invite.expiresAt < new Date()) throw badRequest("Invite code has expired");
  if (invite.usedCount >= invite.maxUses) throw badRequest("Invite code has reached its maximum uses");

  // Check if already a member
  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: invite.roomId, userId: params.userId } },
    select: { id: true },
  });
  if (existing) throw conflict("You are already a member of this room");

  // Join + increment usedCount atomically
  const [, room] = await prisma.$transaction([
    prisma.roomMember.create({
      data: { roomId: invite.roomId, userId: params.userId },
    }),
    prisma.room.findUniqueOrThrow({
      where: { id: invite.roomId },
      select: { id: true, name: true, ownerId: true, createdAt: true },
    }),
    prisma.roomInvite.update({
      where: { id: invite.id },
      data: { usedCount: { increment: 1 } },
    }),
  ]);

  return { ok: true, room };
}

