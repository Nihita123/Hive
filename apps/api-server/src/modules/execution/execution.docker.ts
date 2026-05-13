import Docker from "dockerode";
import { env } from "../../config/env";
import type { ExecutionJobResult, SupportedLanguage } from "./execution.types";

const docker = new Docker();

// ─── Language config ──────────────────────────────────────────────────────────

type LangSpec = {
  image: string;
  cmd: (code: string) => string[];
};

const LANG_SPEC: Record<SupportedLanguage, LangSpec> = {
  javascript: {
    image: "node:20-alpine",
    cmd: (code) => ["node", "-e", code],
  },
  python: {
    image: "python:3.12-alpine",
    cmd: (code) => ["python3", "-c", code],
  },
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n[truncated — output exceeded ${max} bytes]`;
}

function parseMemoryLimit(limit: string): number {
  const lower = limit.toLowerCase();
  if (lower.endsWith("g")) return parseFloat(lower) * 1024 * 1024 * 1024;
  if (lower.endsWith("m")) return parseFloat(lower) * 1024 * 1024;
  if (lower.endsWith("k")) return parseFloat(lower) * 1024;
  return parseInt(lower, 10);
}

// ─── Main execution function ──────────────────────────────────────────────────

export async function runInDocker(params: {
  language: SupportedLanguage;
  code: string;
  input: string;
}): Promise<ExecutionJobResult> {
  const spec = LANG_SPEC[params.language];
  const startedAt = Date.now();

  const container = await docker.createContainer({
    Image: spec.image,
    Cmd: spec.cmd(params.code),
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: true,
    StdinOnce: true,
    Tty: false,
    NetworkDisabled: true,
    HostConfig: {
      Memory: parseMemoryLimit(env.execution.memoryLimit),
      MemorySwap: parseMemoryLimit(env.execution.memoryLimit),
      CpuQuota: env.execution.cpuQuota,
      CpuPeriod: env.execution.cpuPeriod,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      AutoRemove: false,
    },
  });

  let timedOut = false;

  try {
    await container.start();

    // Write stdin if provided
    if (params.input) {
      const stdinStream = await container.attach({
        stream: true,
        stdin: true,
        stdout: false,
        stderr: false,
      });
      stdinStream.write(params.input);
      stdinStream.end();
    }

    // Race container completion vs timeout
    const waitResult = await Promise.race([
      container.wait() as Promise<{ StatusCode: number }>,
      new Promise<null>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, env.execution.timeoutMs),
      ),
    ]);

    if (timedOut) {
      await container.kill().catch(() => {});
    }

    const exitCode = timedOut ? null : waitResult!.StatusCode;

    // Use container.logs() AFTER the container has stopped — this is the
    // reliable way to get all output. The multiplexed stream approach races
    // against container exit and can miss data.
    const logBuffer = await new Promise<Buffer>((resolve, reject) => {
      container.logs(
        { stdout: true, stderr: true, follow: false },
        (err, stream) => {
          if (err) return reject(err);
          if (!stream) return resolve(Buffer.alloc(0));

          const chunks: Buffer[] = [];
          // stream is a Buffer when follow=false in some dockerode versions
          if (Buffer.isBuffer(stream)) {
            return resolve(stream);
          }
          (stream as NodeJS.ReadableStream).on("data", (chunk: Buffer) => chunks.push(chunk));
          (stream as NodeJS.ReadableStream).on("end", () => resolve(Buffer.concat(chunks)));
          (stream as NodeJS.ReadableStream).on("error", reject);
        },
      );
    });

    // Demux the Docker multiplexed log stream
    // Format: [stream_type(1), 0,0,0, size(4), ...data]
    let stdout = "";
    let stderr = "";
    let offset = 0;

    while (offset + 8 <= logBuffer.length) {
      const streamType = logBuffer[offset];
      const size = logBuffer.readUInt32BE(offset + 4);
      offset += 8;
      if (offset + size > logBuffer.length) break;
      const chunk = logBuffer.slice(offset, offset + size).toString("utf8");
      offset += size;
      if (streamType === 1) stdout += chunk;
      else if (streamType === 2) stderr += chunk;
    }

    // Fallback: if demux produced nothing but buffer has content, treat as raw text
    if (!stdout && !stderr && logBuffer.length > 0) {
      stdout = logBuffer.toString("utf8");
    }

    const max = env.execution.maxOutputBytes;
    return {
      stdout: truncate(stdout, max),
      stderr: truncate(stderr, max),
      exitCode,
      durationMs: Date.now() - startedAt,
      timedOut,
    };
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}
