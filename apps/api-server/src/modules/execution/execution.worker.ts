/**
 * Execution Worker — run as a separate process:
 *   npm run worker
 *
 * This process:
 *  1. Connects to Redis via BullMQ
 *  2. Picks up jobs from the "code-execution" queue
 *  3. Runs each job inside an isolated Docker container
 *  4. Stores the result in BullMQ (for HTTP polling)
 *  5. Publishes the result to Redis pub/sub (for Socket.IO push notification)
 */

// Load .env before anything else
import "dotenv/config";

import { Worker } from "bullmq";
import { createRedisClient } from "../../config/redis";
import { runInDocker } from "./execution.docker";
import { EXECUTION_QUEUE_NAME } from "./execution.queue";
import { publishExecutionResult, EXECUTION_NOTIFY_CHANNEL } from "./execution.notify";
import type { ExecutionJobData, ExecutionJobResult } from "./execution.types";

const connection = createRedisClient("bullmq-worker");

// Dedicated pub client for execution result notifications
const notifyPub = createRedisClient("worker-notify-pub");
notifyPub.connect().then(() => {
  console.log(`[Worker] Notification publisher connected (channel: ${EXECUTION_NOTIFY_CHANNEL})`);
}).catch((err: Error) => {
  console.error(`[Worker] Notification publisher failed to connect — ${err.message}`);
});

const worker = new Worker<ExecutionJobData, ExecutionJobResult>(
  EXECUTION_QUEUE_NAME,
  async (job) => {
    console.log(
      `[Worker] Processing job ${job.id} — lang=${job.data.language} project=${job.data.projectId} user=${job.data.userId}`,
    );

    const result = await runInDocker({
      language: job.data.language,
      code: job.data.code,
      input: job.data.input,
    });

    console.log(
      `[Worker] Job ${job.id} finished — exitCode=${result.exitCode} duration=${result.durationMs}ms timedOut=${result.timedOut}`,
    );

    // Publish to Redis so the API server can push via Socket.IO
    await publishExecutionResult(notifyPub, {
      jobId:      job.id!,
      projectId:  job.data.projectId,
      userId:     job.data.userId,
      status:     result.exitCode === 0 ? "completed" : "failed",
      output:     result.stdout,
      error:      result.stderr,
      exitCode:   result.exitCode,
      durationMs: result.durationMs,
      timedOut:   result.timedOut,
    });

    return result;
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 2),
  },
);

// ── Lifecycle logging ─────────────────────────────────────────────────────────

worker.on("ready", () =>
  console.log(`[Worker] Ready — listening on queue "${EXECUTION_QUEUE_NAME}"`),
);

worker.on("active", (job) =>
  console.log(`[Worker] Job ${job.id} is now active`),
);

worker.on("completed", (job) =>
  console.log(`[Worker] Job ${job.id} completed successfully`),
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed — ${err.message}`);

  // Still notify the project room so the frontend can show an error state
  if (job) {
    void publishExecutionResult(notifyPub, {
      jobId:      job.id!,
      projectId:  job.data.projectId,
      userId:     job.data.userId,
      status:     "failed",
      output:     "",
      error:      err.message,
      exitCode:   null,
      durationMs: 0,
      timedOut:   false,
    });
  }
});

worker.on("error", (err) =>
  console.error(`[Worker] Worker error — ${err.message}`),
);

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal} — shutting down gracefully…`);
  await worker.close();
  notifyPub.disconnect();
  console.log("[Worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT",  () => void shutdown("SIGINT"));
