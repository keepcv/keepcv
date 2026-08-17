import {
  CareerRecordKindMismatchError,
  ConcurrencyConflictError,
  type ConstraintKind,
  ConstraintViolationError,
  DuplicatePointRecordLinkError,
  NotFoundError,
  StoreNotEmptyError,
  TagMergedIntoItselfError,
} from "@keepcv/core";
import { PROBLEM_TYPES, type Problem, UnsupportedSchemaVersionError } from "@keepcv/schema";
import { ZodError } from "zod";

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";
}

// Carries the state the server holds, so the UI can show both sides.
export class StaleWriteError extends Error {
  override readonly name = "StaleWriteError";
  readonly current: unknown;

  constructor(conflict: ConcurrencyConflictError, current: unknown) {
    super(conflict.message, { cause: conflict });
    this.current = current;
  }
}

// The re-read is the point of the 409, and it cannot happen inside the
// transaction that just rolled back.
export async function mutate<T>(
  write: () => Promise<T>,
  readCurrent: () => Promise<unknown>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) {
      throw new StaleWriteError(error, await readCurrent().catch(() => undefined));
    }
    throw error;
  }
}

// A taken sort key is resolved by re-reading; a missing parent was wrong when it
// was sent.
const CONSTRAINT_STATUS: Record<ConstraintKind, 409 | 422> = {
  unique: 409,
  foreignKey: 422,
  check: 422,
};

// Array steps read as indices - `body[0].c[0].href` - so the offending node can
// be found without counting.
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, segment) => {
    if (typeof segment === "number") {
      return `${text}[${segment}]`;
    }
    return text === "" ? String(segment) : `${text}.${String(segment)}`;
  }, "");
}

function validationProblem(error: ZodError, instance: string): Problem {
  return {
    type: PROBLEM_TYPES.validationFailed,
    title: "Validation failed",
    status: 422,
    detail: error.issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`).join("; "),
    instance,
    errors: error.issues.map((issue) => ({ path: formatPath(issue.path), code: issue.code })),
  };
}

export function problemFor(error: unknown, instance: string): Problem {
  if (error instanceof ZodError) {
    return validationProblem(error, instance);
  }
  if (error instanceof UnauthorizedError) {
    return {
      type: PROBLEM_TYPES.unauthorized,
      title: "Unauthorized",
      status: 401,
      detail: "This request carried no valid session token.",
      instance,
    };
  }
  if (error instanceof NotFoundError) {
    return {
      type: PROBLEM_TYPES.notFound,
      title: "Not found",
      status: 404,
      detail: error.message,
      instance,
    };
  }
  if (error instanceof StaleWriteError) {
    return {
      type: PROBLEM_TYPES.staleWrite,
      title: "Stale write",
      status: 409,
      detail: error.message,
      instance,
      current: error.current,
    };
  }
  if (error instanceof ConcurrencyConflictError) {
    return {
      type: PROBLEM_TYPES.staleWrite,
      title: "Stale write",
      status: 409,
      detail: error.message,
      instance,
    };
  }
  if (error instanceof ConstraintViolationError) {
    return {
      type: PROBLEM_TYPES.constraintViolated,
      title: "The store refused the write",
      status: CONSTRAINT_STATUS[error.kind],
      detail: error.message,
      instance,
      constraint: error.constraint,
    };
  }
  // A 409: the primary already says it, and the caller resolves it by re-reading.
  if (error instanceof DuplicatePointRecordLinkError) {
    return {
      type: PROBLEM_TYPES.constraintViolated,
      title: "The store refused the write",
      status: 409,
      detail: error.message,
      instance,
    };
  }
  // Not a 409: nothing changed under the caller and re-reading would not help.
  if (error instanceof CareerRecordKindMismatchError) {
    return {
      type: PROBLEM_TYPES.validationFailed,
      title: "Validation failed",
      status: 422,
      detail: error.message,
      instance,
      errors: [{ path: "patch.kind", code: "wrong_record_kind" }],
    };
  }
  // Not a 409, for the reason above.
  if (error instanceof TagMergedIntoItselfError) {
    return {
      type: PROBLEM_TYPES.validationFailed,
      title: "Validation failed",
      status: 422,
      detail: error.message,
      instance,
      errors: [{ path: "intoTagId", code: "same_tag" }],
    };
  }
  if (error instanceof StoreNotEmptyError) {
    return {
      type: PROBLEM_TYPES.storeNotEmpty,
      title: "The store is not empty",
      status: 409,
      detail: error.message,
      instance,
    };
  }
  if (error instanceof UnsupportedSchemaVersionError) {
    return {
      type: PROBLEM_TYPES.unsupportedSchemaVersion,
      title: "Unsupported schema version",
      status: 422,
      detail: error.message,
      instance,
    };
  }

  // Logged rather than described: `detail` reaches the client.
  console.error(error);
  return {
    type: PROBLEM_TYPES.internalError,
    title: "Internal error",
    status: 500,
    detail: "The server failed to handle this request.",
    instance,
  };
}
