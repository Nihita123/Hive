import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized } from "../utils/errors";

type JwtPayload = {
  sub: string;
  email: string;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) throw unauthorized();

  const token = header.slice("bearer ".length).trim();

  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & Partial<JwtPayload>;
    const userId = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;

    if (!userId || !email) throw unauthorized();

    req.user = { id: userId, email };
    return next();
  } catch {
    return next(unauthorized());
  }
}

