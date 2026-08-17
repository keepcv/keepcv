import { careerRecordSchema, organisationSchema, type Store } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../lib/api.js";
import {
  addEntry,
  addEntryPoint,
  addMetric,
  addPhrasing,
  addPoint,
  addRecord,
  addResume,
  addSection,
  aFilledStore,
  emptyStore,
} from "../store.harness.js";
import { buildRouter } from "./router.js";

// Only the network is stubbed: the wiring is what a screen test would not touch.
function mount(answer: (url: string, init?: RequestInit) => Response, path = "/"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => Promise.resolve(answer(String(url), init))),
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
    headers: { "content-type": status < 400 ? "application/json" : "application/problem+json" },
  });
}

interface Call {
  method: string;
  path: string;
  body: unknown;
}

function create(store: Store, { path, body }: Call, at: string): Response {
  const row = { ...(body as object), createdAt: at, updatedAt: at, archivedAt: null };
  if (path === "/v1/organisations") {
    store.organisations.push(organisationSchema.parse(row));
  } else {
    store.records.push(careerRecordSchema.parse(row));
  }
  return jsonOf(row, 201);
}

function amend(store: Store, { method, path, body }: Call, at: string): Response {
  const id = /^\/v1\/records\/([^/]+)/.exec(path)?.[1];
  const index = store.records.findIndex((row) => row.id === id);
  const found = store.records[index];
  if (found === undefined) return jsonOf({ status: 404 }, 404);

  const patch =
    method === "DELETE"
      ? { archivedAt: at }
      : path.endsWith("/restore")
        ? { archivedAt: null }
        : (body as { patch: object }).patch;
  const row = careerRecordSchema.parse({ ...found, ...patch, updatedAt: at });
  store.records.splice(index, 1, row);
  return jsonOf(row);
}

// A stub that writes, so an optimistic row is checked against what comes back
// rather than against itself.
function storeServer(store: Store, intercept?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];

  function answer(url: string, init?: RequestInit): Response {
    const call: Call = {
      method: init?.method ?? "GET",
      path: new URL(url).pathname,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);

    const forced = intercept?.(call);
    if (forced !== undefined) return forced;
    if (call.method === "GET") return jsonOf(store);

    const at = new Date().toISOString();
    const isCreate = call.path === "/v1/organisations" || call.path === "/v1/records";
    return isCreate ? create(store, call, at) : amend(store, call, at);
  }

  return { answer, calls };
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function press(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
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
  // capturing before deciding where it belongs must not lose it. The nudge is a
  // link, because a count nobody can act on is decoration.
  it("surfaces a point nobody has placed, and opens the list of them", async () => {
    mount(() => jsonOf(aFilledStore()));

    const nudge = await screen.findByRole("link", { name: /points captured but not placed/ });
    expect(nudge).toHaveAttribute("href", expect.stringContaining("filter=unplaced"));
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

describe("writing a record", () => {
  it("adds one, along with the organisation it names", async () => {
    const store = emptyStore();
    const server = storeServer(store);
    mount(server.answer, "/records/new?kind=experience");

    expect(await screen.findByRole("heading", { name: "New record" })).toBeInTheDocument();
    type("Title", "Engine lead");
    type("Organisation", "Analytical Engines");
    press("Add record");

    // Opening the record proves the write landed and the cache holds it: the id
    // was minted here, so the optimistic row is the row.
    expect(await screen.findByRole("heading", { name: "Engine lead" })).toBeInTheDocument();
    expect(server.calls.map((call) => `${call.method} ${call.path}`)).toContain(
      "POST /v1/organisations",
    );
    expect(store.records[0]?.title).toBe("Engine lead");
    expect(store.records[0]?.organisationId).toBe(store.organisations[0]?.id);
  });

  // An idle mutation reports `null`, not `undefined`, so the wrong emptiness
  // check put a red panel on a form nobody had touched.
  it("opens with nothing to apologise for", async () => {
    mount(storeServer(emptyStore()).answer, "/records/new");

    expect(await screen.findByRole("heading", { name: "New record" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a refused date on the field that holds it, and sends nothing", async () => {
    const store = emptyStore();
    const server = storeServer(store);
    mount(server.answer, "/records/new?kind=project");

    expect(await screen.findByRole("heading", { name: "New record" })).toBeInTheDocument();
    type("Started", "April 2019");
    press("Add record");

    expect(await screen.findByText(/expected YYYY/)).toBeInTheDocument();
    expect(server.calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });

  // Archiving is the only removal there is, and it reverses.
  it("archives from the record's own screen, and restores it again", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "project", title: "Shelved idea" });
    const server = storeServer(store);
    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("button", { name: "Archive" });
    press("Archive");

    expect(await screen.findByText("Archived, and kept")).toBeInTheDocument();
    expect(store.records[0]?.archivedAt).not.toBeNull();

    press("Restore");
    await screen.findByRole("button", { name: "Archive" });
    expect(store.records[0]?.archivedAt).toBeNull();
    expect(server.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      "GET /v1/store",
      `DELETE /v1/records/${record.id}`,
      "GET /v1/store",
      `POST /v1/records/${record.id}/restore`,
      "GET /v1/store",
    ]);
  });

  // Silent last-write-wins is the one resolution this product cannot offer.
  it("shows both sides when the record changed underneath, and keeps neither", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "project", title: "Difference Engine" });
    const server = storeServer(store, (call) =>
      call.method === "PATCH"
        ? jsonOf(
            {
              type: "https://keepcv.app/problems/stale-write",
              title: "Stale write",
              status: 409,
              detail: "the record changed after it was read",
              instance: `/v1/records/${record.id}`,
              current: { ...record, title: "Difference Engine, mark II" },
            },
            409,
          )
        : undefined,
    );

    mount(server.answer, `/records/${record.id}/edit`);

    expect(await screen.findByRole("heading", { name: "Edit record" })).toBeInTheDocument();
    type("Title", "Analytical Engine");
    press("Save");

    expect(
      await screen.findByText("This record changed while you were editing it"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Analytical Engine/)).toBeInTheDocument();
    expect(screen.getByText(/Difference Engine, mark II/)).toBeInTheDocument();
    expect(store.records[0]?.title).toBe("Difference Engine");
  });
});

describe("points", () => {
  it("lists every point with the record it is filed under", async () => {
    const answer = vi.fn(() => jsonOf(aFilledStore()));
    mount(answer, "/points");

    expect(await screen.findByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Engine lead" }).length).toBeGreaterThan(0);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("narrows to the ones nobody has placed", async () => {
    mount(() => jsonOf(aFilledStore()), "/points?filter=unplaced");

    expect(await screen.findByText("Somewhere, eventually")).toBeInTheDocument();
    expect(screen.queryByText("Cut p95 latency from 800ms to 120ms")).not.toBeInTheDocument();
  });
});

describe("a resume", () => {
  it("opens onto what it is made of, marking what is placed but off", async () => {
    const store = aFilledStore();
    const resumeId = store.resumes[0]?.id ?? "";
    const answer = vi.fn(() => jsonOf(store));

    mount(answer, `/resumes/${resumeId}`);

    expect(
      await screen.findByRole("heading", { name: "Staff engineer, 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    // Placed and toggled off: it stays on the screen, dimmed and counted, and
    // only the document drops it.
    expect(screen.getByText("Rewrote the scheduler").closest("li")).toHaveAttribute(
      "data-off",
      "true",
    );
    expect(screen.getAllByText("off").length).toBe(1);
    expect(screen.getByText(/1 placed and toggled off/)).toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  // The preview compiles in the browser from the cached store, which is the
  // whole reason `@keepcv/core` does no I/O.
  it("compiles the document client-side, without a second request", async () => {
    const store = aFilledStore();
    const resumeId = store.resumes[0]?.id ?? "";
    const answer = vi.fn(() => jsonOf(store));

    mount(answer, `/resumes/${resumeId}?view=preview`);

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Experience", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(screen.queryByText("Rewrote the scheduler")).not.toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  // A resume pins the phrasing and not the set, so the words on the screen are
  // the ones this resume chose rather than the canonical ones.
  it("shows the wording this resume chose", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Canonical wording", { recordId: record.id });
    const angled = addPhrasing(store, point.phrasingSetId, "Angled for this application", {
      label: "for Acme",
      sortKey: "a1",
    });
    const resume = addResume(store, { name: "Angled" });
    const entry = addEntry(store, addSection(store, resume.id), record.id);
    addEntryPoint(store, entry, point, { phrasingId: angled.id });

    mount(() => jsonOf(store), `/resumes/${resume.id}`);

    expect(await screen.findByText("Angled for this application")).toBeInTheDocument();
    expect(screen.queryByText("Canonical wording")).not.toBeInTheDocument();
    expect(screen.getByText("for Acme")).toBeInTheDocument();
  });

  // Silently losing a section is the destructive behaviour the product exists
  // to eliminate, so the preview names the gap.
  it("says an empty section prints nothing rather than dropping the heading", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const resume = addResume(store, { name: "Nothing selected" });
    const section = addSection(store, resume.id);
    addEntry(store, section, record.id, { isVisible: false });

    mount(() => jsonOf(store), `/resumes/${resume.id}?view=preview`);

    expect(
      await screen.findByRole("heading", { name: "Experience", level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing under this heading prints.")).toBeInTheDocument();
  });

  it("says so when the id is not in the store", async () => {
    mount(() => jsonOf(aFilledStore()), "/resumes/01a00ff5-0000-7000-8000-000000000000");

    expect(await screen.findByText("No resume with that id")).toBeInTheDocument();
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
