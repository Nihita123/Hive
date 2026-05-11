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
exports.myRooms = exports.getRoomDetails = exports.leaveRoom = exports.joinRoom = exports.createRoom = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const validate_1 = require("../../utils/validate");
const errors_1 = require("../../utils/errors");
const roomsService = __importStar(require("./rooms.service"));
const createRoomSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80).optional(),
});
const roomIdParamSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1),
});
function requireUser(req) {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return req.user;
}
exports.createRoom = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { name } = (0, validate_1.parseBody)(createRoomSchema, req.body);
    const room = await roomsService.createRoom({ ownerId: user.id, name: name ?? null });
    return res.status(201).json({ room });
});
exports.joinRoom = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { roomId } = roomIdParamSchema.parse(req.params);
    const result = await roomsService.joinRoom({ roomId, userId: user.id });
    return res.status(200).json(result);
});
exports.leaveRoom = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { roomId } = roomIdParamSchema.parse(req.params);
    const result = await roomsService.leaveRoom({ roomId, userId: user.id });
    return res.status(200).json(result);
});
exports.getRoomDetails = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const { roomId } = roomIdParamSchema.parse(req.params);
    const room = await roomsService.getRoomDetails({ roomId, userId: user.id });
    return res.status(200).json({ room });
});
exports.myRooms = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = requireUser(req);
    const rooms = await roomsService.listMyRooms({ userId: user.id });
    return res.status(200).json({ rooms });
});
