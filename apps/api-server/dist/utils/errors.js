"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.badRequest = badRequest;
exports.unauthorized = unauthorized;
exports.conflict = conflict;
exports.notFound = notFound;
class AppError extends Error {
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}
exports.AppError = AppError;
function badRequest(message, details) {
    return new AppError(400, "BAD_REQUEST", message, details);
}
function unauthorized(message = "Unauthorized") {
    return new AppError(401, "UNAUTHORIZED", message);
}
function conflict(message, details) {
    return new AppError(409, "CONFLICT", message, details);
}
function notFound(message = "Not Found") {
    return new AppError(404, "NOT_FOUND", message);
}
