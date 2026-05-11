"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.me = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const asyncHandler_1 = require("../../utils/asyncHandler");
const validate_1 = require("../../utils/validate");
const errors_1 = require("../../utils/errors");
const authService = __importStar(require("./auth.service"));
const signupSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email(),
    password: zod_1.z.string().min(8).max(72),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email(),
    password: zod_1.z.string().min(1).max(72),
});
exports.register = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = (0, validate_1.parseBody)(signupSchema, req.body);
    const result = await authService.register(email, password);
    return res.status(201).json(result);
});
exports.login = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { email, password } = (0, validate_1.parseBody)(loginSchema, req.body);
    const result = await authService.login(email, password);
    if (!result)
        return res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return res.status(200).json(result);
});
exports.me = (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    if (!req.user)
        throw (0, errors_1.unauthorized)();
    return res.status(200).json({ user: req.user });
});
