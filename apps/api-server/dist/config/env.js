"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required env var: ${name}`);
    return value;
}
exports.env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 5000),
    jwtSecret: requireEnv("JWT_SECRET"),
};
