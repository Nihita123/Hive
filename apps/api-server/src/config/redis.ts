import Redis from "ioredis";
import { env } from "./env";

/**
 * Create a named ioredis client from REDIS_URL.
 *
 * Options:
 * - lazyConnect: true         → no TCP connection until .connect() is called
 * - maxRetriesPerRequest: null → required by @socket.io/redis-adapter and BullMQ;
 *                                lets them manage their own retry logic
 *
 * Exported so BullMQ, the Socket.IO adapter, and any other consumer can each
 * create their own dedicated connection without sharing state.
 */
export function createRedisClient(name: string): Redis {
  if (!env.redisUrl) {
    throw new Error(
      `[Redis:${name}] Cannot create client — REDIS_URL is not set`,
    );
  }
  const client = new Redis(env.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 10_000);
      console.warn(`[Redis:${name}] Reconnecting in ${delay}ms (attempt ${times})…`);
      return delay;
    },
  });

  client.on("connect",      () => console.log(`[Redis:${name}] Connected`));
  client.on("ready",        () => console.log(`[Redis:${name}] Ready`));
  client.on("error",  (err: Error) => console.error(`[Redis:${name}] Error — ${err.message}`));
  client.on("close",        () => console.warn(`[Redis:${name}] Connection closed`));
  client.on("reconnecting", () => console.warn(`[Redis:${name}] Reconnecting…`));
  client.on("end",          () => console.warn(`[Redis:${name}] Connection ended`));

  return client;
}

export type RedisClients = { pub: Redis; sub: Redis };

/**
 * Connect two dedicated pub/sub clients for the Socket.IO Redis adapter.
 * Returns null when REDIS_URL is absent or the initial connection fails,
 * allowing the server to fall back to single-instance mode.
 */
export async function connectRedisClients(): Promise<RedisClients | null> {
  if (!env.redisUrl) {
    console.log("[Redis] REDIS_URL not set — running in single-instance mode");
    return null;
  }

  const pub = createRedisClient("pub");
  const sub = createRedisClient("sub");

  try {
    await Promise.all([pub.connect(), sub.connect()]);
    console.log("[Redis] pub/sub clients connected — Socket.IO Redis adapter enabled");
    return { pub, sub };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Redis] Initial connection failed (${message}) — falling back to single-instance mode`);
    pub.disconnect();
    sub.disconnect();
    return null;
  }
}
