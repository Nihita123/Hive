// ─── Supported languages ─────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ["javascript", "python"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

// ─── Docker image + run command per language ─────────────────────────────────

export type LanguageConfig = {
  /** Docker image to use */
  image: string;
  /** Given the code string, return the argv to pass to the container */
  buildCmd: (code: string) => string[];
};

export const LANGUAGE_CONFIG: Record<SupportedLanguage, LanguageConfig> = {
  javascript: {
    image: "node:20-alpine",
    // Pass code via stdin so no file is written to the container filesystem
    buildCmd: () => ["node", "--input-type=module", "-e", ""],
  },
  python: {
    image: "python:3.12-alpine",
    buildCmd: () => ["python3", "-c", ""],
  },
};

// ─── Job payload (stored in BullMQ) ──────────────────────────────────────────

export type ExecutionJobData = {
  /** The project this execution belongs to (for audit / future features) */
  projectId: string;
  language: SupportedLanguage;
  /** Source code to execute */
  code: string;
  /** Optional stdin fed to the process */
  input: string;
  /** ID of the user who submitted the job */
  userId: string;
};

// ─── Job result (stored by BullMQ as the job's return value) ─────────────────

export type ExecutionJobResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /** Wall-clock time in ms */
  durationMs: number;
  timedOut: boolean;
};

// ─── HTTP response shapes ─────────────────────────────────────────────────────

export type JobStatusResponse = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "unknown";
  output?: string;
  error?: string;
  exitCode?: number | null;
  durationMs?: number;
  timedOut?: boolean;
};
