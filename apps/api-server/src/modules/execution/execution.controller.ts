import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/validate";
import { unauthorized } from "../../utils/errors";
import * as executionService from "./execution.service";

const executeSchema = z.object({
  projectId: z.string().min(1),
  language:  z.string().min(1),
  code:      z.string().min(1).max(50_000),
  input:     z.string().max(10_000).default(""),
});

const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

function requireUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}

/**
 * POST /api/execute
 * Enqueue a code execution job. Returns the jobId immediately.
 */
export const enqueue = asyncHandler(async (req: Request, res: Response) => {
  const user = requireUser(req);
  const body = parseBody(executeSchema, req.body);

  const result = await executionService.enqueueExecution({
    projectId: body.projectId,
    language:  body.language,
    code:      body.code,
    input:     body.input,
    userId:    user.id,
  });

  return res.status(202).json(result);
});

/**
 * GET /api/execute/:jobId
 * Poll the status and result of a previously submitted job.
 */
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
  requireUser(req);
  const { jobId } = jobIdParamSchema.parse(req.params);

  const result = await executionService.getJobStatus(jobId);
  return res.status(200).json(result);
});
