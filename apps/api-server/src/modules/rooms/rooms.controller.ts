import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/validate";
import { unauthorized } from "../../utils/errors";
import * as roomsService from "./rooms.service";

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
});

const roomIdParamSchema = z.object({
  roomId: z.string().min(1),
});

function requireUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { name } = parseBody(createRoomSchema, req.body);

  const room = await roomsService.createRoom({ ownerId: user.id, name: name ?? null });
  return res.status(201).json({ room });
});

export const joinRoom = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const result = await roomsService.joinRoom({ roomId, userId: user.id });
  return res.status(200).json(result);
});

export const leaveRoom = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const result = await roomsService.leaveRoom({ roomId, userId: user.id });
  return res.status(200).json(result);
});

export const getRoomDetails = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const room = await roomsService.getRoomDetails({ roomId, userId: user.id });
  return res.status(200).json({ room });
});

export const myRooms = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const rooms = await roomsService.listMyRooms({ userId: user.id });
  return res.status(200).json({ rooms });
});

export const deleteRoom = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const result = await roomsService.deleteRoom({ roomId, userId: user.id });
  return res.status(200).json(result);
});

const transferOwnershipSchema = z.object({
  userId: z.string().min(1),
});

export const transferOwnership = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);
  const { userId: newOwnerId } = parseBody(transferOwnershipSchema, req.body);

  const result = await roomsService.transferOwnership({
    roomId,
    currentOwnerId: user.id,
    newOwnerId,
  });
  return res.status(200).json(result);
});

export const createInvite = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const invite = await roomsService.createInvite({ roomId, userId: user.id });
  return res.status(201).json({ invite });
});

const joinByInviteSchema = z.object({
  code: z.string().min(1),
});

export const joinByInvite = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { code } = parseBody(joinByInviteSchema, req.body);

  const result = await roomsService.joinByInvite({ code, userId: user.id });
  return res.status(200).json(result);
});

