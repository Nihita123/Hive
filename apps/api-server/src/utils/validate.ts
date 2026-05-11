import type { ZodSchema } from "zod";
import { ZodError } from "zod";
import { badRequest } from "./errors";

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const formatted = result.error.flatten();
  throw badRequest("Invalid request body", {
    fieldErrors: formatted.fieldErrors,
    formErrors: formatted.formErrors,
  });
}

export { ZodError };

