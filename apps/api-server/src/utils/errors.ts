export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: AppErrorCode;
  public readonly details?: unknown;

  constructor(statusCode: number, code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Unauthorized") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function conflict(message: string, details?: unknown) {
  return new AppError(409, "CONFLICT", message, details);
}

export function notFound(message = "Not Found") {
  return new AppError(404, "NOT_FOUND", message);
}

export function forbidden(message = "Forbidden") {
  return new AppError(403, "FORBIDDEN", message);
}

