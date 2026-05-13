import { Router } from "express";
import { requireAuth } from "../../middleware/authJwt";
import * as roomsController from "./rooms.controller";

export const roomsRouter = Router();

roomsRouter.use(requireAuth);

roomsRouter.post("/",                          roomsController.createRoom);
roomsRouter.get("/me",                         roomsController.myRooms);

// Invite — join-by-invite has no :roomId so must come before /:roomId routes
roomsRouter.post("/join-by-invite",            roomsController.joinByInvite);

roomsRouter.get("/:roomId",                    roomsController.getRoomDetails);
roomsRouter.post("/:roomId/join",              roomsController.joinRoom);
roomsRouter.post("/:roomId/leave",             roomsController.leaveRoom);
roomsRouter.delete("/:roomId",                 roomsController.deleteRoom);
roomsRouter.post("/:roomId/transfer-ownership", roomsController.transferOwnership);
roomsRouter.post("/:roomId/invite",            roomsController.createInvite);
