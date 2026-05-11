import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/validate";
import { unauthorized } from "../../utils/errors";
import * as projectsService from "./projects.service";
import { getActiveUsers } from "../../realtime/presence";

const createProjectSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  language: z.string().trim().min(1).max(40),
  code: z.string().optional(),
});

const updateCodeSchema = z.object({
  code: z.string(),
  version: z.number().int().min(1),
});

const projectIdParamSchema = z.object({
  projectId: z.string().min(1),
});

const roomIdParamSchema = z.object({
  roomId: z.string().min(1),
});

function requireUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const body = parseBody(createProjectSchema, req.body);

  const project = await projectsService.createProject({
    roomId: body.roomId,
    userId: user.id,
    name: body.name,
    language: body.language,
    code: body.code,
  });

  return res.status(201).json({ project });
});

export const updateProjectCode = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { projectId } = projectIdParamSchema.parse(req.params);
  const { code, version } = parseBody(updateCodeSchema, req.body);

  const result = await projectsService.updateProjectCode({
    projectId,
    userId: user.id,
    code,
    version,
  });

  if (!result.ok) {
    // 409 Conflict — return the latest server state so the client can resync
    return res.status(409).json({
      error: "VERSION_CONFLICT",
      message: "Version mismatch. Fetch the latest version and retry.",
      serverVersion: result.conflict.serverVersion,
      serverCode: result.conflict.serverCode,
    });
  }

  return res.status(200).json({ project: result.project });
});

export const fetchProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { projectId } = projectIdParamSchema.parse(req.params);

  const project = await projectsService.fetchProject({ projectId, userId: user.id });
  return res.status(200).json({ project });
});

export const listRoomProjects = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { roomId } = roomIdParamSchema.parse(req.params);

  const projects = await projectsService.listRoomProjects({ roomId, userId: user.id });
  return res.status(200).json({ projects });
});

export const activeUsers = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { projectId } = projectIdParamSchema.parse(req.params);

  await projectsService.assertProjectAccess({ projectId, userId: user.id });

  const users = getActiveUsers(projectId);
  return res.status(200).json({ projectId, activeUsers: users });
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const { projectId } = projectIdParamSchema.parse(req.params);

  const result = await projectsService.deleteProject({ projectId, userId: user.id });
  return res.status(200).json(result);
});

