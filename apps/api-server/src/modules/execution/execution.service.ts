import { getExecutionQueue } from "./execution.queue";
import { notFound, badRequest } from "../../utils/errors";
import {
  isSupportedLanguage,
  type ExecutionJobData,
  type JobStatusResponse,
} from "./execution.types";

/**
 * Enqueue a code execution job.
 * Returns the BullMQ job ID so the client can poll for results.
 */
export async function enqueueExecution(params: {
  projectId: string;
  language: string;
  code: string;
  input: string;
  userId: string;
}): Promise<{ jobId: string }> {
  if (!isSupportedLanguage(params.language)) {
    throw badRequest(
      `Unsupported language "${params.language}". Supported: javascript, python`,
    );
  }

  const queue = getExecutionQueue();

  const jobData: ExecutionJobData = {
    projectId: params.projectId,
    language: params.language,
    code: params.code,
    input: params.input,
    userId: params.userId,
  };

  const job = await queue.add("execute", jobData);

  console.log(`[ExecutionService] Job ${job.id} queued (lang=${params.language}, project=${params.projectId})`);

  return { jobId: job.id! };
}

/**
 * Retrieve the current status and result of an execution job.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const queue = getExecutionQueue();
  const job = await queue.getJob(jobId);

  if (!job) throw notFound(`Execution job "${jobId}" not found`);

  const state = await job.getState();

  // Map BullMQ states to our API states
  const statusMap: Record<string, JobStatusResponse["status"]> = {
    waiting:  "queued",
    delayed:  "queued",
    active:   "running",
    completed: "completed",
    failed:   "failed",
    unknown:  "unknown",
  };

  const status = statusMap[state] ?? "unknown";

  if (status === "completed" && job.returnvalue) {
    const result = job.returnvalue;
    return {
      jobId,
      status,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    };
  }

  if (status === "failed") {
    return {
      jobId,
      status,
      error: job.failedReason ?? "Unknown error",
    };
  }

  return { jobId, status };
}
