"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = createProject;
exports.updateProjectCode = updateProjectCode;
exports.fetchProject = fetchProject;
exports.listRoomProjects = listRoomProjects;
const prisma_1 = require("../../db/prisma");
const errors_1 = require("../../utils/errors");
async function assertRoomMembership(params) {
    const membership = await prisma_1.prisma.roomMember.findUnique({
        where: {
            roomId_userId: { roomId: params.roomId, userId: params.userId },
        },
        select: { id: true },
    });
    if (!membership)
        throw (0, errors_1.notFound)("Room not found");
}
async function createProject(params) {
    await assertRoomMembership({ roomId: params.roomId, userId: params.userId });
    const project = await prisma_1.prisma.project.create({
        data: {
            roomId: params.roomId,
            name: params.name,
            language: params.language,
            code: params.code ?? "",
        },
        select: {
            id: true,
            roomId: true,
            name: true,
            language: true,
            code: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return project;
}
async function updateProjectCode(params) {
    const project = await prisma_1.prisma.project.findUnique({
        where: { id: params.projectId },
        select: { id: true, roomId: true },
    });
    if (!project)
        throw (0, errors_1.notFound)("Project not found");
    await assertRoomMembership({ roomId: project.roomId, userId: params.userId });
    const updated = await prisma_1.prisma.project.update({
        where: { id: params.projectId },
        data: { code: params.code },
        select: {
            id: true,
            roomId: true,
            name: true,
            language: true,
            code: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return updated;
}
async function fetchProject(params) {
    const project = await prisma_1.prisma.project.findUnique({
        where: { id: params.projectId },
        select: {
            id: true,
            roomId: true,
            name: true,
            language: true,
            code: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    if (!project)
        throw (0, errors_1.notFound)("Project not found");
    await assertRoomMembership({ roomId: project.roomId, userId: params.userId });
    return project;
}
async function listRoomProjects(params) {
    await assertRoomMembership({ roomId: params.roomId, userId: params.userId });
    const projects = await prisma_1.prisma.project.findMany({
        where: { roomId: params.roomId },
        select: {
            id: true,
            roomId: true,
            name: true,
            language: true,
            updatedAt: true,
            createdAt: true,
        },
        orderBy: { updatedAt: "desc" },
    });
    return projects;
}
