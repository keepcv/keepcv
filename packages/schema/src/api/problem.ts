import { z } from "zod";

// RFC 9457. Every error the API returns has this shape, so the client switches
// on `type` and renders a typed problem instead of parsing prose
// (api-contract.md #2).
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
    // A plain string rather than a union of the constants above. Self-hosted
    // deployments routinely run a client older than the server, and a problem
    // type that build has never heard of still has to parse and render.
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    detail: z.string(),
    instance: z.string(),
    errors: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
    // Which constraint the store refused the write on, so a client can map a
    // known one to its own wording instead of showing the generic detail.
    constraint: z.string().optional(),
    // A stale write carries the state the server actually holds, so the UI can
    // show both sides rather than discarding one of them (api-contract.md #2).
    current: z.unknown().optional(),
  })
  .meta({ id: "Problem", title: "Problem" });

export type Problem = z.infer<typeof problemSchema>;
