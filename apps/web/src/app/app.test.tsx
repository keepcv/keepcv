import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/api.js";
import { addMetric, addPoint, addRecord, aFilledStore, emptyStore } from "../store.harness.js";
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

  // The kind list is navigation rather than a filter bar above the content, so
  // it is on every screen and it lists only what the store actually holds.
  it("navigates by what the store holds", async () => {
    mount(() => jsonOf(aFilledStore()));

    const nav = (await screen.findAllByRole("navigation", { name: "Store" }))[0];
    expect(nav).toHaveTextContent("Experience");
    expect(nav).toHaveTextContent("Projects");
    expect(nav).not.toHaveTextContent("Publications");
  });
});

describe("a record", () => {
  // The record list was a dead end before this: every row now opens, and the
  // point's words come from the boot payload, which is why the current revision
  // is in it.
  it("opens onto its points, with the metric that measured them", async () => {
    const store = emptyStore();
    const role = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Cut p95 latency from 800ms to 120ms", { recordId: role.id });
    addMetric(store, point.id);
    const answer = vi.fn(() => jsonOf(store));

    mount(answer, `/records/${role.id}`);

    expect(await screen.findByRole("heading", { name: "Engine lead" })).toBeInTheDocument();
    expect(screen.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(screen.getByText("Latency 120ms")).toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("invites a first point rather than showing an empty list", async () => {
    const store = emptyStore();
    const record = addRecord(store, { title: "Fresh record" });
    addPoint(store, "elsewhere");

    mount(() => jsonOf(store), `/records/${record.id}`);

    expect(await screen.findByRole("heading", { name: "Fresh record" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it("says so when the id is not in the store", async () => {
    mount(() => jsonOf(aFilledStore()), "/records/01a00ff5-0000-7000-8000-000000000000");

    expect(await screen.findByText("No record with that id")).toBeInTheDocument();
  });
});

describe("search", () => {
  // Records and points together, and answered from the cached store: the whole
  // interaction is one request rather than one per keystroke.
  it("finds records and the points under them, with no second request", async () => {
    const answer = vi.fn(() => jsonOf(aFilledStore()));
    mount(answer, "/search?q=engine");

    expect(await screen.findByText(/for "engine"/)).toBeInTheDocument();
    expect(screen.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(screen.getByText("Difference Engine")).toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("matches on a prefix, so it answers mid-word", async () => {
    mount(() => jsonOf(aFilledStore()), "/search?q=laten");

    expect(await screen.findByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
  });

  it("leaves archived rows out until asked", async () => {
    mount(() => jsonOf(aFilledStore()), "/search?q=shelved");

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });
});
