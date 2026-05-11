import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { SocketUser } from "./types";

type JwtPayload = {
  sub: string;
  email: string;
};

export function getUserFromAuthToken(token: string): SocketUser | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload & Partial<JwtPayload>;
    const id = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    if (!id || !email) return null;
    return { id, email };
  } catch {
    return null;
  }
}

