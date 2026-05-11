import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  nodeEnv:   process.env.NODE_ENV ?? "development",
  port:      Number(process.env.PORT ?? 5000),
  jwtSecret: requireEnv("JWT_SECRET"),

  /** Optional — when absent the server runs in single-instance mode (no Redis adapter) */
  redisUrl: process.env.REDIS_URL ?? null,

  execution: {
    /** Hard timeout (ms) before the container is force-killed */
    timeoutMs: Number(process.env.EXEC_TIMEOUT_MS ?? 10_000),
    /** Max memory the container may use */
    memoryLimit: process.env.EXEC_MEMORY_LIMIT ?? "128m",
    /** CPU quota — fraction of one core (0.5 = 50 % of one CPU) */
    cpuQuota: Number(process.env.EXEC_CPU_QUOTA ?? 50_000),   // Docker unit: microseconds per 100 ms
    cpuPeriod: Number(process.env.EXEC_CPU_PERIOD ?? 100_000),
    /** Max characters captured from stdout + stderr combined */
    maxOutputBytes: Number(process.env.EXEC_MAX_OUTPUT_BYTES ?? 100_000),
  },
};
