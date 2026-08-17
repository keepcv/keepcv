import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/api.js";
import { addPoint, addRecord, aFilledStore, emptyStore } from "../store.harness.js";
import { buildRouter } from "./router.js";

// Only the network is stubbed: the wiring is what a screen test would not touch.
function mount(answer: () => Response, path = "/"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(answer())),
  );
  window.history.replaceState(null, "", path);

  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter({ queries, api: apiClient("a-token") });

  render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function jsonOf(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status === 200 ? "application/json" : "application/problem+json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the app", () => {
  it("boots from one request and shows what is in the store", async () => {
    mount(() => jsonOf(aFilledStore()));

    expect(await screen.findByText("Engine lead")).toBeInTheDocument();
    // Two live records and one archived, counted separately rather than hidden.
    expect(await screen.findByText("Archived")).toBeInTheDocument();
  });

  it("reads the record list out of the same payload, with no second request", async () => {
    const answer = vi.fn(() => jsonOf(aFilledStore()));
    mount(answer, "/records");

    expect(await screen.findByText("Difference Engine")).toBeInTheDocument();
    // The point's words come from the boot payload, which is the reason the
    // current revision is in it.
    expect(screen.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  // Typed end to end: the API answers RFC 9457, so this is the problem's own
  // title rather than a message parsed out of prose.
  it("renders a problem when the token is wrong", async () => {
    mount(() =>
      jsonOf(
        {
          type: "https://keepcv.app/problems/unauthorized",
          title: "Unauthorized",
          status: 401,
          detail: "No session token was presented.",
          instance: "/v1/store",
        },
        401,
      ),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Unauthorized");
    expect(await screen.findByText(/token is minted per launch/)).toBeInTheDocument();
  });

  // The moment the data-entry cold start is won or lost: it invites the first
  // entry rather than reporting a count of zero.
  it("invites a first entry rather than showing an empty dashboard", async () => {
    mount(() => jsonOf(emptyStore()));

    expect(await screen.findByText("Nothing in the store yet")).toBeInTheDocument();
    expect(screen.queryByText("Loose ends")).not.toBeInTheDocument();
  });

  it("shows the archived record only when the filter asks for it", async () => {
    mount(() => jsonOf(aFilledStore()), "/records?archived=only");

    expect(await screen.findByText("Shelved idea")).toBeInTheDocument();
    expect(screen.queryByText("Difference Engine")).not.toBeInTheDocument();
  });

  it("narrows to one kind from the URL", async () => {
    mount(() => jsonOf(aFilledStore()), "/records?kind=experience");

    expect(await screen.findByText("Engine lead")).toBeInTheDocument();
    expect(screen.queryByText("Difference Engine")).not.toBeInTheDocument();
  });

  // A point with no record is the inbox, and the overview is where it surfaces:
  // capturing before deciding where it belongs must not lose it.
  it("surfaces a point nobody has placed", async () => {
    mount(() => jsonOf(aFilledStore()));

    await waitFor(() => {
      expect(screen.getByText("Somewhere, eventually")).toBeInTheDocument();
    });
    expect(screen.getByText(/points captured but not placed/)).toBeInTheDocument();
  });

  it("says a record has no points yet rather than showing an empty list", async () => {
    const store = emptyStore();
    addRecord(store, { title: "Fresh record" });
    addPoint(store, "elsewhere");
    mount(() => jsonOf(store), "/records");

    expect(await screen.findByText("Fresh record")).toBeInTheDocument();
    expect(screen.getByText(/No points yet/)).toBeInTheDocument();
  });
});
