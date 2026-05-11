"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
function errorHandler(err, _req, res, _next) {
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
            details: err.details,
        });
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            return res.status(409).json({
                error: "CONFLICT",
                message: "Resource already exists",
                meta: err.meta,
            });
        }
    }
    if (err instanceof Error) {
        return res.status(500).json({ error: "INTERNAL", message: "Internal Server Error" });
    }
    return res.status(500).json({ error: "INTERNAL", message: "Internal Server Error" });
}
