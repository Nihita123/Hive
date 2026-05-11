import { Router } from "express";
import * as authController from "./auth.controller";
import { requireAuth } from "../../middleware/authJwt";

export const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.get("/me", requireAuth, authController.me);

