import type { ApiClient } from "@keepcv/api";
import { type Problem, problemSchema } from "@keepcv/schema";
import type { EditorFailure } from "./host.js";

export type { ApiClient };

// So no component parses prose or switches on a status code off a Response.
export class ProblemError extends Error {
  override readonly name = "ProblemError";
  readonly problem: Problem;
  readonly retryAfter: string | undefined;

  constructor(problem: Problem, retryAfter?: string) {
    super(problem.detail);
    this.problem = problem;
    this.retryAfter = retryAfter;
  }
}

export function isProblem(error: unknown): error is ProblemError {
  return error instanceof ProblemError;
}

// A mismatched build is the normal state of self-hosted software, so this gets
// a problem rather than a parse error.
export async function unwrap(response: Response): Promise<unknown> {
  // Discarding a draft answers 204, and parsing an empty body as JSON throws -
  // which surfaced as an error panel on a write that had in fact landed.
  if (response.status === 204) return undefined;
  if (response.ok) return await response.json();

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = problemSchema.safeParse(body);
  if (parsed.success)
    throw new ProblemError(parsed.data, response.headers.get("retry-after") ?? undefined);

  throw new ProblemError(
    {
      type: "about:blank",
      title: "The store answered in a way this build does not understand",
      status: Math.min(Math.max(response.status, 400), 599),
      detail: `${String(response.status)} with a body that is not a problem document.`,
      instance: response.url ? new URL(response.url).pathname : "",
    },
    response.headers.get("retry-after") ?? undefined,
  );
}

export function failureOf(error: unknown): EditorFailure {
  if (isProblem(error))
    return {
      message: error.message,
      problem: error.problem,
      ...(error.retryAfter === undefined ? {} : { retryAfter: error.retryAfter }),
    };
  return {
    message:
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "The request could not finish.",
  };
}
