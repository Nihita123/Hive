import type { Request, Response, NextFunction } from "express";

/**
 * Minimal request lifecycle logger.
 * Logs method, path, status code, and response time on every request.
 * Skipped for /api/health and /api/ready to avoid log noise.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const skip = req.path === "/health" || req.path === "/ready" || req.path === "/";
  if (skip) return next();

  const startedAt = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    // eslint-disable-next-line no-console
    console.log(
      `[HTTP] ${level} ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`,
    );
  });

  next();
}
