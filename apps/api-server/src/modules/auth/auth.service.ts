import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";

const SALT_ROUNDS = 12;

function signAccessToken(user: { id: string; email: string }) {
  return jwt.sign(
    { email: user.email },
    env.jwtSecret,
    {
      subject: user.id,
      expiresIn: "7d",
    },
  );
}

export async function register(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  const token = signAccessToken(user);
  return { user, token };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, createdAt: true },
  });

  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const token = signAccessToken({ id: user.id, email: user.email });
  const safeUser = { id: user.id, email: user.email, createdAt: user.createdAt };
  return { user: safeUser, token };
}

