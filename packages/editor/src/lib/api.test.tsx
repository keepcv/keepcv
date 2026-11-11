import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Failure } from "../app/states.js";
import { failureOf, ProblemError, unwrap } from "./api.js";
import { HostContext } from "./host.js";

afterEach(cleanup);
it.each([401, 403, 409, 429, 503])(
  "preserves status %s and server Retry-After for host actions",
  async (status) => {
    const problem = {
      type: "about:blank",
      title: "Synthetic refusal",
      status,
      detail: "Retain the unsent input",
      instance: "/v1/synthetic",
    };
    const error = await unwrap(
      new Response(JSON.stringify(problem), { status, headers: { "Retry-After": "120" } }),
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ProblemError);
    const action = vi.fn();
    const recovery = vi.fn(() => [{ id: "recover", label: "Account settings", onSelect: action }]);
    render(
      <HostContext.Provider value={{ recoveryActions: recovery }}>
        <Failure error={error} />
      </HostContext.Provider>,
    );
    expect(recovery).toHaveBeenCalledWith({ message: problem.detail, problem, retryAfter: "120" });
    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("120");
  },
);
it("retains malformed response status without parsing prose for actions", async () => {
  const failure = await unwrap(
    new Response("Legacy text", {
      status: 429,
      headers: { "Retry-After": "Wed, 11 Nov 2026 12:00:00 GMT" },
    }),
  ).catch((error: unknown) => failureOf(error));
  expect(failure).toMatchObject({
    problem: { status: 429 },
    retryAfter: "Wed, 11 Nov 2026 12:00:00 GMT",
  });
  expect(failureOf(new Error("Transport unavailable"))).toEqual({
    message: "Transport unavailable",
  });
});
