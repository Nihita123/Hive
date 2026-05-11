"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpServer = createHttpServer;
exports.createSocketServer = createSocketServer;
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const auth_1 = require("./auth");
const projects_socket_1 = require("./projects.socket");
function extractBearerToken(header) {
    if (typeof header !== "string")
        return null;
    if (!header.toLowerCase().startsWith("bearer "))
        return null;
    return header.slice("bearer ".length).trim();
}
function createHttpServer(app) {
    return (0, http_1.createServer)(app);
}
function createSocketServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: true, credentials: true },
    });
    // Auth middleware for sockets (JWT)
    io.use((socket, next) => {
        const authHeader = socket.handshake.headers["authorization"];
        const tokenFromHeader = extractBearerToken(authHeader);
        const token = tokenFromHeader ??
            (typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null);
        if (!token)
            return next(new Error("Unauthorized"));
        const user = (0, auth_1.getUserFromAuthToken)(token);
        if (!user)
            return next(new Error("Unauthorized"));
        socket.user = user;
        return next();
    });
    io.on("connection", (socket) => {
        const authedSocket = socket;
        (0, projects_socket_1.registerProjectSocketHandlers)(io, authedSocket);
    });
    return io;
}
// For future Redis adapter support:
// export async function enableRedisAdapter(io: SocketServer) { ... }
