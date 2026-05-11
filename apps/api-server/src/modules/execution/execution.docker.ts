import Docker from "dockerode";
import { env } from "../../config/env";
import type { ExecutionJobResult, SupportedLanguage } from "./execution.types";

const docker = new Docker(); // connects via /var/run/docker.sock by default

// ─── Language → image + run command ──────────────────────────────────────────

type LangSpec = {
  image: string;
  /** Build the Cmd array. Code is passed as the last argument. */
  cmd: (code: string) => string[];
};

const LANG_SPEC: Record<SupportedLanguage, LangSpec> = {
  javascript: {
    image: "node:20-alpine",
    // `node -e <code>` — no file written, no shell injection possible
    cmd: (code) => ["node", "-e", code],
  },
  python: {
    image: "python:3.12-alpine",
    cmd: (code) => ["python3", "-c", code],
  },
};

// ─── Output stream demux ──────────────────────────────────────────────────────

/**
 * Docker multiplexes stdout and stderr into a single stream with an 8-byte
 * header per chunk: [stream_type(1), 0,0,0, size(4)].
 * stream_type: 1 = stdout, 2 = stderr
 */
function demuxDockerStream(buffer: Buffer): { stdout: string; stderr: string } {
  let offset = 0;
  let stdout = "";
  let stderr = "";

  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) break;

    const chunk = buffer.slice(offset, offset + size).toString("utf8");
    offset += size;

    if (streamType === 1) stdout += chunk;
    else if (streamType === 2) stderr += chunk;
  }

  return { stdout, stderr };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n[truncated — output exceeded ${max} bytes]`;
}

// ─── Main execution function ──────────────────────────────────────────────────

export async function runInDocker(params: {
  language: SupportedLanguage;
  code: string;
  input: string;
}): Promise<ExecutionJobResult> {
  const spec = LANG_SPEC[params.language];
  const startedAt = Date.now();

  // Create the container — throws if Docker is unavailable
  const container = await docker.createContainer({
    Image: spec.image,
    Cmd: spec.cmd(params.code),

    // Attach stdio so we can feed stdin and capture stdout/stderr
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    OpenStdin: true,
    StdinOnce: true,
    Tty: false,

    // ── Security hardening ────────────────────────────────────────────────
    NetworkDisabled: true,   // no outbound network access

    HostConfig: {
      // Memory hard limit
      Memory: parseMemoryLimit(env.execution.memoryLimit),
      MemorySwap: parseMemoryLimit(env.execution.memoryLimit), // disable swap

      // CPU throttle
      CpuQuota: env.execution.cpuQuota,
      CpuPeriod: env.execution.cpuPeriod,

      // Drop ALL Linux capabilities
      CapDrop: ["ALL"],

      // Prevent privilege escalation
      SecurityOpt: ["no-new-privileges"],

      // No access to host devices
      Devices: [],

      AutoRemove: false, // we remove manually after capturing output
    },
  });

  let timedOut = false;

  try {
    // Attach to the multiplexed stream before starting
    const stream = await container.attach({
      stream: true,
      stdout: true,
      stderr: true,
      stdin: true,
    });

    // Collect all output chunks
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    await container.start();

    // Write stdin then close it
    if (params.input) {
      stream.write(params.input);
    }
    stream.end();

    // Race: container finishes vs hard timeout
    const waitResult = await Promise.race([
      container.wait() as Promise<{ StatusCode: number }>,
      new Promise<null>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, env.execution.timeoutMs),
      ),
    ]);

    // Kill if timed out
    if (timedOut) {
      await container.kill().catch(() => { /* already dead */ });
    }

    const exitCode = timedOut ? null : waitResult!.StatusCode;

    // Give the stream a tick to flush any remaining buffered data
    await new Promise((r) => setTimeout(r, 50));

    const rawBuffer = Buffer.concat(chunks);
    const { stdout, stderr } = demuxDockerStream(rawBuffer);
    const maxBytes = env.execution.maxOutputBytes;

    return {
      stdout: truncate(stdout, maxBytes),
      stderr: truncate(stderr, maxBytes),
      exitCode,
      durationMs: Date.now() - startedAt,
      timedOut,
    };
  } finally {
    // Always remove the container — even if an error was thrown
    await container.remove({ force: true }).catch(() => { /* already removed */ });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a Docker-style memory string ("128m", "512m", "1g") into bytes.
 */
function parseMemoryLimit(limit: string): number {
  const lower = limit.toLowerCase();
  if (lower.endsWith("g")) return parseFloat(lower) * 1024 * 1024 * 1024;
  if (lower.endsWith("m")) return parseFloat(lower) * 1024 * 1024;
  if (lower.endsWith("k")) return parseFloat(lower) * 1024;
  return parseInt(lower, 10);
}
