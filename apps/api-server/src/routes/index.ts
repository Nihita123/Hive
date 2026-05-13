import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { roomsRouter } from "../modules/rooms/rooms.routes";
import { projectsRouter } from "../modules/projects/projects.routes";
import { executionRouter } from "../modules/execution/execution.routes";
import { authLimiter, executionLimiter } from "../middleware/rateLimiter";
import { prisma } from "../db/prisma";
import { env } from "../config/env";

export const apiRouter = Router();

// ── Health ────────────────────────────────────────────────────────────────────

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * Readiness probe — checks DB and Redis connectivity.
 * Returns 200 only when all required dependencies are reachable.
 * Use this for Kubernetes readinessProbe / load balancer health checks.
 */
apiRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = {};

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // Redis check (only if configured)
  if (env.redisUrl) {
    try {
      const { createRedisClient } = await import("../config/redis.js");
      const probe = createRedisClient("readiness-probe");
      await probe.connect();
      await probe.ping();
      probe.disconnect();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json({ ok: allOk, checks });
});

// ── Feature routes ────────────────────────────────────────────────────────────

apiRouter.use("/auth", authLimiter, authRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/execute", executionLimiter, executionRouter);
