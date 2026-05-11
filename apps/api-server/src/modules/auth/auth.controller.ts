import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/validate";
import { unauthorized } from "../../utils/errors";
import * as authService from "./auth.service";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = parseBody(signupSchema, req.body);

  const result = await authService.register(email, password);
  return res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = parseBody(loginSchema, req.body);

  const result = await authService.login(email, password);
  if (!result) return res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });

  return res.status(200).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw unauthorized();
  return res.status(200).json({ user: req.user });
});

