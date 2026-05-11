"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.leaveRoom = leaveRoom;
exports.getRoomDetails = getRoomDetails;
exports.listMyRooms = listMyRooms;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../utils/errors");
async function createRoom(params) {
    const room = await prisma_1.prisma.room.create({
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
async function joinRoom(params) {
    const room = await prisma_1.prisma.room.findUnique({
        where: { id: params.roomId },
        select: { id: true },
    });
    if (!room)
        throw (0, errors_1.notFound)("Room not found");
    try {
        await prisma_1.prisma.roomMember.create({
            data: { roomId: params.roomId, userId: params.userId },
        });
    }
    catch (e) {
        // Unique constraint (already a member) will be mapped by errorHandler too,
        // but we return a cleaner message here.
        throw (0, errors_1.conflict)("User already in room");
    }
    return { ok: true };
}
async function leaveRoom(params) {
    const room = await prisma_1.prisma.room.findUnique({
        where: { id: params.roomId },
        select: { id: true, ownerId: true },
    });
    if (!room)
        throw (0, errors_1.notFound)("Room not found");
    // Owner must remain a member (can be changed later via transfer ownership feature)
    if (room.ownerId === params.userId)
        throw (0, errors_1.conflict)("Room owner cannot leave the room");
    await prisma_1.prisma.roomMember.deleteMany({
        where: { roomId: params.roomId, userId: params.userId },
    });
    return { ok: true };
}
async function getRoomDetails(params) {
    const room = await prisma_1.prisma.room.findUnique({
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
    if (!room)
        throw (0, errors_1.notFound)("Room not found");
    const isMember = room.members.some((m) => m.user.id === params.userId);
    if (!isMember)
        throw (0, errors_1.notFound)("Room not found");
    return room;
}
async function listMyRooms(params) {
    const rooms = await prisma_1.prisma.room.findMany({
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
