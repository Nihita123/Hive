import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors";

/**
 * Central error handler.
 *
 * All errors — whether thrown manually (AppError) or by Prisma — are
 * normalised to the same JSON shape:
 *   { error: string, message: string, details?: unknown }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // ── Known application errors ───────────────────────────────────────────────
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error:   err.code,
      message: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
  }

  // ── Prisma known errors ────────────────────────────────────────────────────
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 — unique constraint violation
    if (err.code === "P2002") {
      return res.status(409).json({
        error:   "CONFLICT",
        message: "Resource already exists",
        details: err.meta,
      });
    }
    // P2025 — record not found (e.g. delete on non-existent row)
    if (err.code === "P2025") {
      return res.status(404).json({
        error:   "NOT_FOUND",
        message: "Resource not found",
      });
    }
  }

  // ── Unexpected errors ──────────────────────────────────────────────────────
  if (err instanceof Error) {
    // Log unexpected errors with stack trace for debugging
    console.error(`[ErrorHandler] Unhandled error on ${req.method} ${req.originalUrl}:`, err);
  }

  return res.status(500).json({
    error:   "INTERNAL",
    message: "Internal Server Error",
  });
}
