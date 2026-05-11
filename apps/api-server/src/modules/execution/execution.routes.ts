import { Router } from "express";
import { requireAuth } from "../../middleware/authJwt";
import * as executionController from "./execution.controller";

export const executionRouter = Router();

executionRouter.use(requireAuth);

executionRouter.post("/",         executionController.enqueue);
executionRouter.get("/:jobId",    executionController.getStatus);
