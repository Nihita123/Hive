import { prisma } from "../../db/prisma";
import { conflict, notFound, forbidden } from "../../utils/errors";

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

