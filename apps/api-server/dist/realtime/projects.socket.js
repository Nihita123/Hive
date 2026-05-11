"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProjectSocketHandlers = registerProjectSocketHandlers;
const zod_1 = require("zod");
const prisma_1 = require("../db/prisma");
const rooms_1 = require("./rooms");
const joinLeaveSchema = zod_1.z.object({ projectId: zod_1.z.string().min(1) });
const codeChangeSchema = zod_1.z.object({ projectId: zod_1.z.string().min(1), code: zod_1.z.string() });
async function assertProjectAccess(params) {
    const project = await prisma_1.prisma.project.findUnique({
        where: { id: params.projectId },
        select: { id: true, roomId: true },
    });
    if (!project)
        return null;
    const member = await prisma_1.prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: project.roomId, userId: params.userId } },
        select: { id: true },
    });
    if (!member)
        return null;
    return project;
}
function registerProjectSocketHandlers(io, socket) {
    socket.on("join_project", async (payload) => {
        const parsed = joinLeaveSchema.safeParse(payload);
        if (!parsed.success)
            return socket.emit("error", { message: "Invalid join_project payload" });
        const project = await assertProjectAccess({
            projectId: parsed.data.projectId,
            userId: socket.user.id,
        });
        if (!project)
            return socket.emit("error", { message: "Project not found" });
        await socket.join((0, rooms_1.projectRoomId)(project.id));
        socket.emit("joined_project", { projectId: project.id });
    });
    socket.on("leave_project", async (payload) => {
        const parsed = joinLeaveSchema.safeParse(payload);
        if (!parsed.success)
            return socket.emit("error", { message: "Invalid leave_project payload" });
        await socket.leave((0, rooms_1.projectRoomId)(parsed.data.projectId));
        socket.emit("left_project", { projectId: parsed.data.projectId });
    });
    socket.on("code_change", async (payload) => {
        const parsed = codeChangeSchema.safeParse(payload);
        if (!parsed.success)
            return socket.emit("error", { message: "Invalid code_change payload" });
        const project = await assertProjectAccess({
            projectId: parsed.data.projectId,
            userId: socket.user.id,
        });
        if (!project)
            return socket.emit("error", { message: "Project not found" });
        // Persist latest code snapshot
        await prisma_1.prisma.project.update({
            where: { id: project.id },
            data: { code: parsed.data.code },
            select: { id: true },
        });
        // Broadcast to everyone else in the same project room (exclude sender)
        socket.to((0, rooms_1.projectRoomId)(project.id)).emit("code_change", {
            projectId: project.id,
            code: parsed.data.code,
            userId: socket.user.id,
        });
    });
}
