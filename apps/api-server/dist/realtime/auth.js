"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFromAuthToken = getUserFromAuthToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
function getUserFromAuthToken(token) {
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.jwtSecret);
        const id = typeof payload.sub === "string" ? payload.sub : undefined;
        const email = typeof payload.email === "string" ? payload.email : undefined;
        if (!id || !email)
            return null;
        return { id, email };
    }
    catch {
        return null;
    }
}
