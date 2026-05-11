import { Queue } from "bullmq";
import { createRedisClient } from "../../config/redis";
import type { ExecutionJobData } from "./execution.types";

export const EXECUTION_QUEUE_NAME = "code-execution";

/**
 * Lazily-initialised queue singleton.
 * We defer creation so the module can be imported without immediately
 * requiring REDIS_URL (useful in tests or when the feature is disabled).
 */
let _queue: Queue<ExecutionJobData> | null = null;

export function getExecutionQueue(): Queue<ExecutionJobData> {
  if (!_queue) {
    const connection = createRedisClient("bullmq-queue");
    _queue = new Queue<ExecutionJobData>(EXECUTION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        // Keep completed jobs for 1 hour so clients can poll results
        removeOnComplete: { age: 3600 },
        // Keep failed jobs for 24 hours for debugging
        removeOnFail: { age: 86_400 },
        attempts: 1,          // No retries — code errors are not transient
      },
    });

    _queue.on("error", (err) =>
      console.error(`[ExecutionQueue] Queue error — ${err.message}`),
    );

    console.log(`[ExecutionQueue] Queue "${EXECUTION_QUEUE_NAME}" initialised`);
  }
  return _queue;
}
