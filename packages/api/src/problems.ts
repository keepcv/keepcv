import {
  CareerRecordKindMismatchError,
  ConcurrencyConflictError,
  type ConstraintKind,
  ConstraintViolationError,
  NotFoundError,
  StoreNotEmptyError,
} from "@keepcv/core";
import { PROBLEM_TYPES, type Problem, UnsupportedSchemaVersionError } from "@keepcv/schema";
import { ZodError } from "zod";

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";
}

// A stale write answers with the state the server actually holds, so the UI can
// show both sides instead of one being dropped silently (api-contract.md #2).
export class StaleWriteError extends Error {
  override readonly name = "StaleWriteError";
  readonly current: unknown;

  constructor(conflict: ConcurrencyConflictError, current: unknown) {
    super(conflict.message, { cause: conflict });
    this.current = current;
  }
}

// Every mutation route goes through here. Re-reading is the whole point of the
// 409, and it cannot happen inside the transaction that just rolled back.
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

// A taken sort key is two clients dragging at once, which the caller resolves by
// re-reading. A missing parent or a column the row's kind may not carry is a
// request that was already wrong when it was sent.
const CONSTRAINT_STATUS: Record<ConstraintKind, 409 | 422> = {
  unique: 409,
  foreignKey: 422,
  check: 422,
};

// Matches the spec's `body[0].c[0].href`: array steps read as indices, so a
// reader can find the offending node without counting.
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
  // Not a 409: the record did not change under the caller, and re-reading would
  // not help. A patch naming the wrong kind was wrong when it was sent.
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

  // Nothing recognised the error, so it is a fault rather than a caller mistake.
  // It is logged rather than described: `detail` reaches the client.
  console.error(error);
  return {
    type: PROBLEM_TYPES.internalError,
    title: "Internal error",
    status: 500,
    detail: "The server failed to handle this request.",
    instance,
  };
}
