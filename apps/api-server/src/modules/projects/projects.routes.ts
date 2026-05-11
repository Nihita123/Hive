import { Router } from "express";
import { requireAuth } from "../../middleware/authJwt";
import * as projectsController from "./projects.controller";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

projectsRouter.post("/", projectsController.createProject);
projectsRouter.get("/room/:roomId", projectsController.listRoomProjects);
projectsRouter.get("/:projectId", projectsController.fetchProject);
projectsRouter.get("/:projectId/active-users", projectsController.activeUsers);
projectsRouter.patch("/:projectId/code", projectsController.updateProjectCode);
projectsRouter.delete("/:projectId", projectsController.deleteProject);

