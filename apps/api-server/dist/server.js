"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const app_1 = require("./app");
const env_1 = require("./config/env");
const prisma_1 = require("./db/prisma");
const socket_1 = require("./realtime/socket");
async function startServer() {
    await prisma_1.prisma.$connect();
    const app = (0, app_1.createApp)();
    const httpServer = (0, socket_1.createHttpServer)(app);
    (0, socket_1.createSocketServer)(httpServer);
    return httpServer.listen(env_1.env.port, () => {
        // eslint-disable-next-line no-console
        console.log(`API listening on http://localhost:${env_1.env.port}`);
    });
}
