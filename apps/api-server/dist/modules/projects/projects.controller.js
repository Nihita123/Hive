"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoomProjects = exports.fetchProject = exports.updateProjectCode = exports.createProject = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const validate_1 = require("../../utils/validate");
const errors_1 = require("../../utils/errors");
const projectsService = __importStar(require("./projects.service"));
const createProjectSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1),
    name: zod_1.z.string().trim().min(1).max(120),
    language: zod_1.z.string().trim().min(1).max(40),
    code: zod_1.z.string().optional(),
});
const updateCodeSchema = zod_1.z.object({
    code: zod_1.z.string(),
});
const projectIdParamSchema = zod_1.z.object({
    projectId: zod_1.z.string().min(1),
});
const roomIdParamSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1),
});
function requireUser(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return req.user;
}
exports.createProject = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const body = (0, validate_1.parseBody)(createProjectSchema, req.body);
    const project = await projectsService.createProject({
        roomId: body.roomId,
        userId: user.id,
        name: body.name,
        language: body.language,
        code: body.code,
    });
    return res.status(201).json({ project });
});
exports.updateProjectCode = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { code } = (0, validate_1.parseBody)(updateCodeSchema, req.body);
    const project = await projectsService.updateProjectCode({
        projectId,
        userId: user.id,
        code,
    });
    return res.status(200).json({ project });
});
exports.fetchProject = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const project = await projectsService.fetchProject({ projectId, userId: user.id });
    return res.status(200).json({ project });
});
exports.listRoomProjects = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { roomId } = roomIdParamSchema.parse(req.params);
    const projects = await projectsService.listRoomProjects({ roomId, userId: user.id });
    return res.status(200).json({ projects });
});
