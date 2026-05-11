"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const errors_1 = require("../utils/errors");
function requireAuth(req, res, next) {
    const header = req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer "))
        throw (0, errors_1.unauthorized)();
    const token = header.slice("bearer ".length).trim();
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        const userId = typeof payload.sub === "string" ? payload.sub : undefined;
        const email = typeof payload.email === "string" ? payload.email : undefined;
        if (!userId || !email)
            throw (0, errors_1.unauthorized)();
        req.user = { id: userId, email };
        return next();
    }
    catch {
        return next((0, errors_1.unauthorized)());
    }
}
