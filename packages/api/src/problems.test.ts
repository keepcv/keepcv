import {
  CareerRecordKindMismatchError,
  ConcurrencyConflictError,
  ConstraintViolationError,
  DuplicatePointRecordLinkError,
  NotFoundError,
  newUuid,
  StoreNotEmptyError,
  TagMergedIntoItselfError,
} from "@keepcv/core";
import {
  PROBLEM_TYPES,
  pointSchema,
  timestampSchema,
  UnsupportedSchemaVersionError,
} from "@keepcv/schema";
import { afterEach, expect, it, vi } from "vitest";
import { problemOf } from "./api.harness.js";
import { createApi } from "./api.js";
import {
  ExportChangedError,
  problemFor,
  StaleWriteError,
  UnauthorizedError,
  type UnexpectedErrorReporter,
} from "./problems.js";

afterEach(() => vi.restoreAllMocks());

const sensitive = new Error("query with synthetic-secret", {
  cause: new Error("SQL parameters: synthetic-private-words"),
});

function failingApi(reportUnexpectedError?: UnexpectedErrorReporter | null) {
  return createApi({
    authenticate: () => Promise.resolve(newUuid()),
    runAsOwner: (_owner, work) => work(),
    unitOfWork: { run: () => Promise.reject(sensitive) },
    ...(reportUnexpectedError === undefined ? {} : { reportUnexpectedError }),
  });
}

it("keeps default reporting and a generic client problem", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const problem = await problemOf(await failingApi().request("/v1/store"));
  expect(consoleError).toHaveBeenCalledExactlyOnceWith(sensitive);
  expect(problem).toEqual({
    type: PROBLEM_TYPES.internalError,
    title: "Internal error",
    status: 500,
    detail: "The server failed to handle this request.",
    instance: "/v1/store",
  });
});

it("disables reporting per API without affecting concurrent consumers", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const reporter = vi.fn<UnexpectedErrorReporter>();
  const [silent, reported] = await Promise.all([
    failingApi(null).request("/v1/store"),
    failingApi(reporter).request("/v1/store"),
  ]);
  expect(await problemOf(silent)).toEqual(await problemOf(reported));
  expect(reporter).toHaveBeenCalledExactlyOnceWith(sensitive);
  expect(consoleError).not.toHaveBeenCalled();
});

it.each(["throw", "reject"])(
  "keeps the original problem when a reporter fails by %s",
  async (how) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reporter = vi.fn(() => {
      if (how === "throw") throw new Error("Reporter unavailable");
      return Promise.reject(new Error("Reporter unavailable"));
    });
    const problem = await problemOf(await failingApi(reporter).request("/v1/store"));
    expect(problem).toEqual(problemFor(sensitive, "/v1/store", null));
    expect(reporter).toHaveBeenCalledOnce();
    expect(consoleError).not.toHaveBeenCalled();
  },
);

const id = newUuid();
const conflict = new ConcurrencyConflictError(
  "point",
  id,
  timestampSchema.parse("2026-10-12T00:00:00.000Z"),
);
const current = { id, confidence: "verified" };

it.each([
  [new UnauthorizedError(), 401, PROBLEM_TYPES.unauthorized],
  [new NotFoundError("point", id), 404, PROBLEM_TYPES.notFound],
  [pointSchema.safeParse({}).error, 422, PROBLEM_TYPES.validationFailed],
  [conflict, 409, PROBLEM_TYPES.staleWrite],
  [new StaleWriteError(conflict, current), 409, PROBLEM_TYPES.staleWrite],
  [
    new ConstraintViolationError("unique", "point_sort_key_unique", { cause: sensitive }),
    409,
    PROBLEM_TYPES.constraintViolated,
  ],
  [
    new ConstraintViolationError("foreignKey", "point_record_fk"),
    422,
    PROBLEM_TYPES.constraintViolated,
  ],
  [new ConstraintViolationError("check", "point_check"), 422, PROBLEM_TYPES.constraintViolated],
  [new DuplicatePointRecordLinkError(id, id), 409, PROBLEM_TYPES.constraintViolated],
  [
    new CareerRecordKindMismatchError(id, "project", "experience"),
    422,
    PROBLEM_TYPES.validationFailed,
  ],
  [new TagMergedIntoItselfError(id), 422, PROBLEM_TYPES.validationFailed],
  [new StoreNotEmptyError("Store has content"), 409, PROBLEM_TYPES.storeNotEmpty],
  [
    new UnsupportedSchemaVersionError("Unsupported version"),
    422,
    PROBLEM_TYPES.unsupportedSchemaVersion,
  ],
  [new ExportChangedError(), 409, PROBLEM_TYPES.staleWrite],
] as const)("does not report the expected problem %s", (error, status, type) => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const reporter = vi.fn<UnexpectedErrorReporter>();
  const original = problemFor(error, "/v1/points");
  expect(original).toMatchObject({ status, type, instance: "/v1/points" });
  expect(problemFor(error, "/v1/points", reporter)).toEqual(original);
  expect(problemFor(error, "/v1/points", null)).toEqual(original);
  if (error instanceof StaleWriteError) expect(original.current).toEqual(current);
  expect(reporter).not.toHaveBeenCalled();
  expect(consoleError).not.toHaveBeenCalled();
});
