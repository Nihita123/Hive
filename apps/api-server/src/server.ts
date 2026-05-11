import type { Server } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { createHttpServer, createSocketServer } from "./realtime/socket";

export async function startServer(): Promise<Server> {
  await prisma.$connect();

  const app = createApp();
  const httpServer = createHttpServer(app);

  // Must await — Redis adapter is attached before any connections are accepted
  await createSocketServer(httpServer);

  return httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

