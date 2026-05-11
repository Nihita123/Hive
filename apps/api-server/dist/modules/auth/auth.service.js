"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../db/prisma");
const env_1 = require("../../config/env");
const SALT_ROUNDS = 12;
function signAccessToken(user) {
    return jsonwebtoken_1.default.sign({ email: user.email }, env_1.env.jwtSecret, {
        subject: user.id,
        expiresIn: "7d",
    });
}
async function register(email, password) {
    const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
    const user = await prisma_1.prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, createdAt: true },
    });
    const token = signAccessToken(user);
    return { user, token };
}
async function login(email, password) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordHash: true, createdAt: true },
    });
    if (!user)
        return null;
    const ok = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!ok)
        return null;
    const token = signAccessToken({ id: user.id, email: user.email });
    const safeUser = { id: user.id, email: user.email, createdAt: user.createdAt };
    return { user: safeUser, token };
}
