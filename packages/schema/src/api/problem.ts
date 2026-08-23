import { z } from "zod";

// RFC 9457.
const PROBLEM_BASE = "https://keepcv.app/problems/";

export const PROBLEM_TYPES = {
  unauthorized: `${PROBLEM_BASE}unauthorized`,
  notFound: `${PROBLEM_BASE}not-found`,
  validationFailed: `${PROBLEM_BASE}validation-failed`,
  staleWrite: `${PROBLEM_BASE}stale-write`,
  constraintViolated: `${PROBLEM_BASE}constraint-violated`,
  storeNotEmpty: `${PROBLEM_BASE}store-not-empty`,
  unsupportedSchemaVersion: `${PROBLEM_BASE}unsupported-schema-version`,
  internalError: `${PROBLEM_BASE}internal-error`,
} as const;

export const problemSchema = z
  .object({
    // Not a union of the constants above: a client older than the server has to
    // parse a problem type its build has never heard of.
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    detail: z.string(),
    instance: z.string(),
    errors: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
    constraint: z.string().optional(),
    // The state the server holds, so the UI can show both sides.
    current: z.unknown().optional(),
  })
  .meta({ id: "Problem", title: "Problem" });

export type Problem = z.infer<typeof problemSchema>;
