/**
 * Execution notification bridge — Redis pub/sub.
 *
 * The worker process cannot import the Socket.IO server directly (separate
 * process). Instead:
 *   Worker  → publishes JSON to Redis channel "execution:completed"
 *   API srv → subscribes, receives message, emits "execution_completed" via io
 *
 * This keeps the worker completely decoupled from the HTTP/WS layer.
 */

import type Redis from "ioredis";
import type { SocketServer } from "../../realtime/socket";
import { projectRoomId } from "../../realtime/rooms";

export const EXECUTION_NOTIFY_CHANNEL = "execution:completed";

export type ExecutionNotifyPayload = {
  jobId: string;
  projectId: string;
  userId: string;
  status: "completed" | "failed";
  output: string;
  error: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
};

/**
 * Called by the worker after a job finishes.
 * Publishes the result to Redis so the API server can forward it via Socket.IO.
 */
export async function publishExecutionResult(
  pub: Redis,
  payload: ExecutionNotifyPayload,
): Promise<void> {
  await pub.publish(EXECUTION_NOTIFY_CHANNEL, JSON.stringify(payload));
}

/**
 * Called once at API server startup.
 * Subscribes to the execution results channel and re-emits via Socket.IO
 * to all users currently in the project room.
 */
export function subscribeExecutionResults(sub: Redis, io: SocketServer): void {
  sub.subscribe(EXECUTION_NOTIFY_CHANNEL, (err) => {
    if (err) {
      console.error(`[ExecutionNotify] Failed to subscribe — ${err.message}`);
      return;
    }
    console.log(`[ExecutionNotify] Subscribed to channel "${EXECUTION_NOTIFY_CHANNEL}"`);
  });

  sub.on("message", (channel, message) => {
    if (channel !== EXECUTION_NOTIFY_CHANNEL) return;

    let payload: ExecutionNotifyPayload;
    try {
      payload = JSON.parse(message) as ExecutionNotifyPayload;
    } catch {
      console.error("[ExecutionNotify] Failed to parse message:", message);
      return;
    }

    // Emit to all sockets in the project room
    io.to(projectRoomId(payload.projectId)).emit("execution_completed", {
      jobId:      payload.jobId,
      projectId:  payload.projectId,
      status:     payload.status,
      output:     payload.output,
      error:      payload.error,
      exitCode:   payload.exitCode,
      durationMs: payload.durationMs,
      timedOut:   payload.timedOut,
    });

    console.log(
      `[ExecutionNotify] Emitted execution_completed for job ${payload.jobId} → project ${payload.projectId}`,
    );
  });
}
