import { createServer, type Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Application } from "express";
import { getUserFromAuthToken } from "./auth";
import { connectRedisClients, createRedisClient } from "../config/redis";
import { subscribeExecutionResults } from "../modules/execution/execution.notify";
import type { ClientToServerEvents, ServerToClientEvents, SocketUser } from "./types";
import { registerProjectSocketHandlers } from "./projects.socket";

export type SocketServer = Server<ClientToServerEvents, ServerToClientEvents>;

function extractBearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice("bearer ".length).trim();
}

export function createHttpServer(app: Application): HttpServer {
  return createServer(app);
}

/**
 * Create and configure the Socket.IO server.
 *
 * Async because we attempt to connect Redis before accepting any socket
 * connections. If Redis is unavailable the server starts normally in
 * single-instance mode — no events are lost, the adapter just isn't attached.
 */
export async function createSocketServer(httpServer: HttpServer): Promise<SocketServer> {
  const io: SocketServer = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // ── Redis adapter + execution notification subscriber ──────────────────────
  const redisClients = await connectRedisClients();

  if (redisClients) {
    io.adapter(createAdapter(redisClients.pub, redisClients.sub));
    console.log("[Socket.IO] Redis adapter attached — horizontal scaling enabled");

    // Dedicated subscriber for execution results (separate from the adapter sub)
    const notifySub = createRedisClient("notify-sub");
    await notifySub.connect();
    subscribeExecutionResults(notifySub, io);
  } else {
    console.log("[Socket.IO] Using default in-memory adapter (single instance)");
    console.warn("[Socket.IO] execution_completed events will not be emitted (Redis required)");
  }

  // ── JWT auth middleware ────────────────────────────────────────────────────
  io.use((socket, next) => {
    const authHeader = socket.handshake.headers["authorization"];
    const tokenFromHeader = extractBearerToken(authHeader);
    const token =
      tokenFromHeader ??
      (typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null);

    if (!token) return next(new Error("Unauthorized"));
    const user = getUserFromAuthToken(token);
    if (!user) return next(new Error("Unauthorized"));

    (socket as typeof socket & { user: SocketUser }).user = user;
    return next();
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on("connection", (socket) => {
    const authedSocket = socket as typeof socket & { user: SocketUser };

    console.log(
      `[Socket.IO] Connected  socketId=${socket.id} userId=${authedSocket.user.id}`,
    );

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket.IO] Disconnected socketId=${socket.id} userId=${authedSocket.user.id} reason=${reason}`,
      );
    });

    registerProjectSocketHandlers(io, authedSocket);
  });

  return io;
}
