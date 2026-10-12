import { createApi, problemFor, type UnexpectedErrorReporter } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { problemSchema } from "@keepcv/schema";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.restoreAllMocks());

it.each(["silent", "custom", "throw", "reject"])(
  "configures installed API reporting with %s while retaining client problems",
  async (mode) => {
    const error = new Error("synthetic-private-text", { cause: new Error("SQL synthetic-secret") });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const events: string[] = [];
    const reporter = vi.fn<UnexpectedErrorReporter>(() => {
      if (mode === "throw") throw new Error("Reporter failed");
      if (mode === "reject") return Promise.reject(new Error("Reporter failed"));
      events.push("keepcv.unexpected_error");
    });
    const reportUnexpectedError = mode === "silent" ? null : reporter;
    const api = createApi({
      unitOfWork: { run: () => Promise.reject(error) },
      runAsOwner: (_owner, work) => work(),
      authenticate: () => Promise.resolve(newUuid()),
      reportUnexpectedError,
    });
    const response = await api.request("/v1/store");
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    expect(problemSchema.parse(await response.json())).toEqual(
      problemFor(error, "/v1/store", null),
    );
    expect(response.status).toBe(500);
    expect(consoleError).not.toHaveBeenCalled();
    if (mode === "silent") expect(reporter).not.toHaveBeenCalled();
    else expect(reporter).toHaveBeenCalledExactlyOnceWith(error);
    expect(events).toEqual(mode === "custom" ? ["keepcv.unexpected_error"] : []);
  },
);
