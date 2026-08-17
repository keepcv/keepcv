import { type ApiClient, createClient } from "@keepcv/api";
import { type Problem, problemSchema } from "@keepcv/schema";

export type { ApiClient };

// So no component parses prose or switches on a status code off a Response.
export class ProblemError extends Error {
  override readonly name = "ProblemError";
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail);
    this.problem = problem;
  }
}

export function isProblem(error: unknown): error is ProblemError {
  return error instanceof ProblemError;
}

export function apiClient(sessionToken: string | undefined): ApiClient {
  return createClient(
    window.location.origin,
    ...(sessionToken === undefined ? [] : [{ sessionToken }]),
  );
}

// A mismatched build is the normal state of self-hosted software, so this gets
// a problem rather than a parse error.
export async function unwrap(response: Response): Promise<unknown> {
  if (response.ok) return await response.json();

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = problemSchema.safeParse(body);
  if (parsed.success) throw new ProblemError(parsed.data);

  throw new ProblemError({
    type: "about:blank",
    title: "The store answered in a way this build does not understand",
    status: Math.min(Math.max(response.status, 400), 599),
    detail: `${String(response.status)} with a body that is not a problem document.`,
    instance: new URL(response.url).pathname,
  });
}
