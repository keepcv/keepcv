import { compile } from "@keepcv/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_AFTER_MS } from "../features/phrasings/model/editor.js";
import { apiClient } from "../lib/api.js";
import {
  addContactChannel,
  addCustomSection,
  addDraft,
  addEntry,
  addEntryPoint,
  addEvidence,
  addMetric,
  addPhrasing,
  addPoint,
  addRecord,
  addRecordField,
  addResume,
  addRevision,
  addRoleProfile,
  addSavedFilter,
  addSection,
  addTag,
  addTemplate,
  aFilledStore,
  emptyStore,
} from "../store.harness.js";
import { jsonOf, storeServer } from "../store-server.harness.js";
import { buildRouter } from "./router.js";

// Only the network is stubbed: the wiring is what a screen test would not
// touch.
function mount(answer: (url: string, init?: RequestInit) => Response, path = "/"): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => Promise.resolve(answer(String(url), init))),
  );
  window.history.replaceState(null, "", path);

  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter({ queries, api: apiClient("a-token"), signOut: undefined });

  render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function press(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

// A file input holds a FileList rather than a value, which is why this is not
// `type`. What follows is read asynchronously, so callers wait on the screen.
function load(label: string, contents: unknown): void {
  const body = JSON.stringify(contents);
  fireEvent.change(screen.getByLabelText(label), {
    target: { files: [new File([body], "design.json", { type: "application/json" })] },
  });
}

// A template renders into a document of its own, so what printed is queried
// through the frame rather than through the app around it.
async function printed(): Promise<ReturnType<typeof within>> {
  const frame = await screen.findByTitle<HTMLIFrameElement>(/as it prints$/);
  const page = frame.contentDocument?.body;
  if (page === null || page === undefined) throw new Error("the preview frame has no document");
  await waitFor(() => {
    expect(page.childElementCount).toBeGreaterThan(0);
  });
  return within(page);
}

const EPOCH_ISO = "2026-01-01T00:00:00.000Z";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  // A kind is a filter of the records list, so it nests under Records rather
  // than standing beside it, and it lists only what the store actually holds.
  it("navigates by what the store holds", async () => {
    mount(() => jsonOf(aFilledStore()));

    const nav = (await screen.findAllByRole("navigation", { name: "Store" }))[0];
    expect(nav).not.toHaveTextContent("Experience");

    press("Show record kinds");

    expect(nav).toHaveTextContent("Experience");
    expect(nav).toHaveTextContent("Projects");
    expect(nav).not.toHaveTextContent("Publications");
  });
});

describe("the command palette", () => {
  function openPalette(): void {
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  }

  it("opens on ctrl-K and on slash, and closes on escape", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });

    openPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  // Slash is a character someone is entitled to type into a field, and the
  // palette stealing it was the bug this guards.
  it("leaves slash alone while a field has focus", async () => {
    mount(() => jsonOf(aFilledStore()), "/records/new");

    const title = await screen.findByLabelText("Title");
    fireEvent.keyDown(title, { key: "/" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The dialog focuses its first focusable on open, and the close button is
  // that element - so it stole focus back from the field and every keystroke
  // after opening went nowhere. Found in a browser, not here.
  it("puts focus in the field, not on the close button", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    openPalette();

    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("offers destinations before anything is typed", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    openPalette();

    const results = within(screen.getByRole("listbox", { name: "Results" }));
    expect(results.getByRole("option", { name: /New record/ })).toBeInTheDocument();
    expect(results.getByRole("option", { name: /Resumes/ })).toBeInTheDocument();
  });

  // The same `search(store, query)` the search screen reads, so the two can
  // never disagree about what matches.
  it("finds a record by prefix and opens it", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    openPalette();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Engine l" } });

    // The record and the point filed under it both name it; records rank first.
    fireEvent.click(screen.getAllByRole("option", { name: /Engine lead/ })[0] as HTMLElement);

    expect(await screen.findByRole("heading", { name: /Engine lead/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // The palette shows only the first few of each subject, so the way to the
  // rest has to be in it.
  it("offers the whole result list as its first row", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    openPalette();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "engine" } });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent(/Search for "engine"/);
  });

  it("moves through the rows with the arrow keys and opens with enter", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    openPalette();

    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "Engine l" } });

    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByRole("heading", { name: /Engine lead/ })).toBeInTheDocument();
  });
});

describe("the app chrome", () => {
  it("collapses the rail to icons and puts it back", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });

    press("Collapse the navigation");
    expect(screen.getAllByRole("navigation", { name: "Store" })[0]).not.toHaveTextContent(
      "Vocabulary",
    );

    press("Expand the navigation");
    expect(screen.getAllByRole("navigation", { name: "Store" })[0]).toHaveTextContent("Vocabulary");
  });

  // Collapsing used to drop the footer holding it.
  it("keeps the colour scheme reachable with the rail collapsed", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });
    const before = screen.getAllByRole("button", { name: "Dark" }).length;

    press("Collapse the navigation");

    expect(screen.getAllByRole("button", { name: "Dark" })).toHaveLength(before);
  });

  it("says how much the narrowing left, on the toolbar", async () => {
    mount(() => jsonOf(aFilledStore()), "/records?archived=exclude");

    expect(await screen.findByText("2 records")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Archived" }));

    expect(await screen.findByText("1 record")).toBeInTheDocument();
  });

  // The rail and the narrow header each render a toggle, so the choice is the
  // shell's rather than each component's: two hooks would let them disagree.
  it("chooses a colour scheme, and both toggles agree", async () => {
    mount(() => jsonOf(aFilledStore()));
    await screen.findByRole("navigation", { name: "Store" });

    fireEvent.click(screen.getAllByRole("button", { name: "Dark" })[0] as HTMLElement);

    for (const toggle of screen.getAllByRole("button", { name: "Dark" })) {
      expect(toggle).toHaveAttribute("aria-pressed", "true");
    }
    expect(document.documentElement).toHaveClass("dark");

    fireEvent.click(screen.getAllByRole("button", { name: "Light" })[0] as HTMLElement);
    expect(document.documentElement).not.toHaveClass("dark");
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

describe("what a record carries beside its points", () => {
  function aRecord() {
    const store = emptyStore();
    const record = addRecord(store, { kind: "project", title: "Difference Engine" });
    return { store, server: storeServer(store), record };
  }

  it("adds a link and takes it off again", async () => {
    const { store, server, record } = aRecord();
    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("heading", { name: "Difference Engine" });
    press("Add a link");
    type("Address", "https://github.com/ada/engine");
    type("Shown as", "The source");
    press("Add link");

    expect(await screen.findByRole("link", { name: "The source" })).toHaveAttribute(
      "href",
      "https://github.com/ada/engine",
    );
    await waitFor(() => {
      expect(store.recordLinks).toHaveLength(1);
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^Remove / })[0] as HTMLElement);

    await waitFor(() => {
      expect(store.recordLinks[0]?.archivedAt).not.toBeNull();
    });
    expect(screen.queryByRole("link", { name: "The source" })).not.toBeInTheDocument();
  });

  it("refuses a link with no address", async () => {
    const { store, server, record } = aRecord();
    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("heading", { name: "Difference Engine" });
    press("Add a link");
    press("Add link");

    expect(await screen.findByText(/too small|expected/i)).toBeInTheDocument();
    expect(store.recordLinks).toEqual([]);
  });

  it("adds a field, deriving the key nobody would type", async () => {
    const { store, server, record } = aRecord();
    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("heading", { name: "Difference Engine" });
    press("Add a field");
    type("Name", "Credential ID");
    type("Value", "AWS-1234");
    press("Add field");

    await waitFor(() => {
      expect(store.recordFields).toHaveLength(1);
    });
    expect(store.recordFields[0]?.key).toBe("credential-id");
    expect(await screen.findByText("AWS-1234")).toBeInTheDocument();
  });

  // `record_field_key_unique` covers archived rows, so a second create would be
  // refused by the index forever. Naming it again puts the row back.
  it("puts a removed field back rather than writing a second one", async () => {
    const { store, server, record } = aRecord();
    addRecordField(store, record.id, { archivedAt: EPOCH_ISO, value: "old" });

    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("heading", { name: "Difference Engine" });
    press("Add a field");
    type("Name", "Credential ID");
    type("Value", "AWS-9999");
    press("Add field");

    await waitFor(() => {
      expect(store.recordFields[0]?.archivedAt).toBeNull();
    });
    expect(store.recordFields).toHaveLength(1);
    expect(store.recordFields[0]?.value).toBe("AWS-9999");
    expect(
      server.calls.filter((call) => call.method === "POST" && call.path.endsWith("restore")),
    ).toHaveLength(1);
  });

  it("says so rather than letting the index refuse a name already there", async () => {
    const { store, server, record } = aRecord();
    addRecordField(store, record.id);

    mount(server.answer, `/records/${record.id}`);

    await screen.findByRole("heading", { name: "Difference Engine" });
    press("Add a field");
    type("Name", "Credential ID");
    press("Add field");

    expect(await screen.findByText("this record already carries that")).toBeInTheDocument();
    expect(store.recordFields).toHaveLength(1);
  });
});

describe("sections of your own", () => {
  it("adds one from an empty screen", async () => {
    const store = emptyStore();
    mount(storeServer(store).answer, "/sections?archived=false");

    await screen.findByText("No sections of your own yet");
    press("New section");
    type("New section", "Patents");
    press("Add");

    await waitFor(() => {
      expect(store.customSections).toHaveLength(1);
    });
    expect(store.customSections[0]?.heading).toBe("Patents");
    expect(await screen.findByText("Patents")).toBeInTheDocument();
  });

  // The kind is hidden while nothing can be filed under it, which is what made
  // the picker on the record form a dead end.
  it("is what makes a custom entry offered at all", async () => {
    const store = emptyStore();
    addCustomSection(store, "Patents");

    mount(storeServer(store).answer, "/records/new");

    expect(await screen.findByRole("option", { name: "Custom entry" })).toBeInTheDocument();
  });

  it("offers no custom entry while there is no section to file one under", async () => {
    mount(storeServer(emptyStore()).answer, "/records/new");

    await screen.findByLabelText("Kind");
    expect(screen.queryByRole("option", { name: "Custom entry" })).not.toBeInTheDocument();
  });

  it("names the heading it would collide with rather than writing a second one", async () => {
    const store = emptyStore();
    addCustomSection(store, "Patents");
    mount(storeServer(store).answer, "/sections?archived=false");

    await screen.findByText("Patents");
    press("New section");
    type("New section", "patents");

    expect(
      await screen.findByText("Patents already prints under that heading."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("renames one, then archives it off the screen", async () => {
    const store = emptyStore();
    addCustomSection(store, "Patents");
    mount(storeServer(store).answer, "/sections?archived=false");

    await screen.findByText("Patents");
    press("Rename");
    type("Heading", "Patents and filings");
    press("Save");

    await waitFor(() => {
      expect(store.customSections[0]?.heading).toBe("Patents and filings");
    });

    press("Archive");
    await waitFor(() => {
      expect(store.customSections[0]?.archivedAt).not.toBeNull();
    });
    expect(await screen.findByText("No sections of your own yet")).toBeInTheDocument();
  });

  it("puts an archived one back from its own filter", async () => {
    const store = emptyStore();
    addCustomSection(store, "Patents", { archivedAt: EPOCH_ISO });
    mount(storeServer(store).answer, "/sections?archived=true");

    await screen.findByText("Patents");
    press("Put back");

    await waitFor(() => {
      expect(store.customSections[0]?.archivedAt).toBeNull();
    });
  });

  it("counts what is filed under one", async () => {
    const store = emptyStore();
    const section = addCustomSection(store, "Patents");
    addRecord(store, { kind: "custom_entry", title: "A filing", customSectionId: section });

    mount(storeServer(store).answer, "/sections?archived=false");

    expect(await screen.findByRole("link", { name: "1 entry" })).toBeInTheDocument();
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

describe("writing a point", () => {
  it("writes the words and the point together", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const server = storeServer(store);
    mount(server.answer, `/points/new?recordId=${record.id}`);

    expect(await screen.findByRole("heading", { name: "New point" })).toBeInTheDocument();
    type("Point", "Cut p95 latency from 800ms to 120ms");
    press("Add point");

    // On the point it just made, with the words it holds: the set, the phrasing
    // and the first revision are one request.
    expect(await screen.findByRole("heading", { name: "Point" })).toBeInTheDocument();
    expect(store.points[0]?.recordId).toBe(record.id);
    expect(store.phrasingRevisions[0]?.plainText).toBe("Cut p95 latency from 800ms to 120ms");
  });

  it("files a point without touching what it says", async () => {
    const store = emptyStore();
    addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Rewrote the scheduler");
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    expect(await screen.findByRole("heading", { name: "Point" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Confidence"), { target: { value: "verified" } });
    press("Save");

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(store.points[0]?.confidence).toBe("verified");
    expect(store.phrasingRevisions).toHaveLength(1);
    expect(server.calls.filter((call) => call.path.endsWith("/revisions"))).toHaveLength(0);
  });

  it("measures a point without leaving the screen", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    expect(await screen.findByRole("heading", { name: "Point" })).toBeInTheDocument();
    type("Label", "p95 latency");
    type("Value", "120");
    type("Unit", "ms");
    type("Was", "800");
    press("Add metric");

    expect(await screen.findByText("p95 latency 800ms -> 120ms")).toBeInTheDocument();
    expect(store.metrics[0]?.pointId).toBe(point.id);
  });

  it("archives a point and restores it again", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Somewhere, eventually");
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    await screen.findByRole("button", { name: "Archive" });
    press("Archive");
    expect(await screen.findByText("Archived, and kept")).toBeInTheDocument();
    expect(store.points[0]?.archivedAt).not.toBeNull();

    press("Restore");
    await screen.findByRole("button", { name: "Archive" });
    expect(store.points[0]?.archivedAt).toBeNull();
  });
});

describe("the phrasing editor", () => {
  function anOpenPoint(text = "Rewrote the scheduler") {
    const store = emptyStore();
    const point = addPoint(store, text);
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);
    return { store, point, server };
  }

  const wrote = (server: ReturnType<typeof storeServer>) =>
    server.calls.filter((call) => call.method === "POST" && call.path.endsWith("/revisions"));

  // Keystrokes never create revisions: a history of 400 single-character
  // revisions is not history.
  it("keeps a draft while you type and appends only once you stop", async () => {
    const { store, server } = anOpenPoint();
    const box = await screen.findByLabelText("Wording, standard");

    fireEvent.change(box, { target: { value: "Rewrote the scheduler, halving tail latency" } });
    expect(await screen.findByText("Kept as a draft", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(store.drafts).toHaveLength(1);
    expect(wrote(server)).toHaveLength(0);
    // The draft this editor just wrote is not one it found waiting, and
    // offering it back would be the editor interrupting itself mid-sentence.
    expect(screen.queryByText("You were part-way through rewording this.")).not.toBeInTheDocument();

    fireEvent.blur(box);
    await waitFor(() => {
      expect(store.phrasingRevisions).toHaveLength(2);
    });
    expect(store.phrasingRevisions[1]?.plainText).toBe(
      "Rewrote the scheduler, halving tail latency",
    );
    // A draft that outlived the revision it became would offer to restore text
    // the phrasing already says.
    expect(store.drafts).toEqual([]);
    // Discarding the draft answers 204, and a client that parsed that as JSON
    // apologised for a write that had landed.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("throws the draft away when the words come back, rather than appending", async () => {
    const { store, server } = anOpenPoint();
    const box = await screen.findByLabelText("Wording, standard");

    fireEvent.change(box, { target: { value: "Rewrote the scheduler again" } });
    await screen.findByText("Kept as a draft", {}, { timeout: 3000 });

    fireEvent.change(box, { target: { value: "  Rewrote the scheduler  " } });
    await waitFor(
      () => {
        expect(store.drafts).toEqual([]);
      },
      { timeout: 3000 },
    );

    fireEvent.blur(box);
    expect(wrote(server)).toHaveLength(0);
    expect(store.phrasingRevisions).toHaveLength(1);
  });

  it("offers a waiting draft rather than resurrecting it", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Rewrote the scheduler");
    const phrasing = store.phrasings[0];
    if (phrasing === undefined) throw new Error("a point is written with the wording it holds");
    addDraft(store, phrasing.id, "Rewrote the scheduler, twice");
    mount(storeServer(store).answer, `/points/${point.id}/edit`);

    const box = await screen.findByLabelText("Wording, standard");
    expect(box).toHaveValue("Rewrote the scheduler");
    expect(screen.getByText("Rewrote the scheduler, twice")).toBeInTheDocument();

    // An editor that started its timers on open would throw the draft away
    // before the offer to keep it had been answered.
    await new Promise((resolve) => setTimeout(resolve, DRAFT_AFTER_MS + 400));
    expect(store.drafts).toHaveLength(1);

    press("Put it back");
    expect(box).toHaveValue("Rewrote the scheduler, twice");
  });

  it("adds a wording from the one it varies, and switches which is canonical", async () => {
    const { store, server } = anOpenPoint();
    await screen.findByLabelText("Wording, standard");

    fireEvent.change(screen.getByLabelText("New variant"), { target: { value: "short" } });
    type("New label", "for infra roles");
    press("Add a wording");

    expect(await screen.findByLabelText("Wording, short")).toHaveValue("Rewrote the scheduler");
    expect(store.phrasings[1]?.label).toBe("for infra roles");
    // A variant is a wording, not a revision: nothing was appended to make one.
    expect(wrote(server)).toHaveLength(0);

    press("Make canonical");
    await waitFor(() => {
      expect(store.phrasingSets[0]?.canonicalPhrasingId).toBe(store.phrasings[1]?.id);
    });
  });

  it("shows everything a wording has said, newest first", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Rewrote the scheduler");
    const phrasing = store.phrasings[0];
    if (phrasing === undefined) throw new Error("a point is written with the wording it holds");
    addRevision(store, phrasing, "Rewrote the scheduler, halving tail latency");
    mount(storeServer(store).answer, `/points/${point.id}/edit`);

    await screen.findByLabelText("Wording, standard");
    press("History");

    const history = await screen.findByRole("list", { name: "Everything this wording has said" });
    const said = within(history).getAllByRole("listitem");
    expect(said[0]?.textContent).toContain("halving tail latency");
    expect(said[0]?.textContent).toContain("what it says now");
    // Superseded wordings are kept, never overwritten.
    expect(said[1]?.textContent).toContain("Rewrote the scheduler");
    expect(said[1]?.textContent).not.toContain("what it says now");
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
  // Composition and preview are one workspace: a preview reached by leaving the
  // screen that changes it is a preview nobody watches while composing.
  it("shows the composition and what it compiles to at the same time", async () => {
    const store = aFilledStore();
    const resumeId = store.resumes[0]?.id ?? "";
    const answer = vi.fn(() => jsonOf(store));

    mount(answer, `/resumes/${resumeId}?view=composition`);

    expect(await screen.findByRole("navigation", { name: "View" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Take Experience off this resume/ }),
    ).toBeInTheDocument();

    const page = await printed();
    expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("compiles the document client-side, without a second request", async () => {
    const store = aFilledStore();
    const resumeId = store.resumes[0]?.id ?? "";
    const answer = vi.fn(() => jsonOf(store));

    mount(answer, `/resumes/${resumeId}?view=preview`);
    const page = await printed();

    expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(page.getByRole("heading", { name: "Experience", level: 2 })).toBeInTheDocument();
    expect(page.getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(page.queryByText("Rewrote the scheduler")).not.toBeInTheDocument();
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

    expect(
      await screen.findByRole("link", { name: "Angled for this application" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Canonical wording" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Wording for Angled for this application")).toHaveValue(angled.id);
  });

  // A wording nobody has typed into yet has text, and it is the empty string, so
  // the picker drew an option with nothing in it and no way to tell them apart.
  it("names an empty wording by what it is for", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Canonical wording", { recordId: record.id });
    addPhrasing(store, point.phrasingSetId, "", { variant: "short", sortKey: "a1" });
    const resume = addResume(store, { name: "Angled" });
    const entry = addEntry(store, addSection(store, resume.id), record.id);
    addEntryPoint(store, entry, point);

    mount(() => jsonOf(store), `/resumes/${resume.id}`);

    const picker = await screen.findByLabelText("Wording for Canonical wording");
    expect([...picker.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "Canonical wording",
      "short",
    ]);
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
    const page = await printed();

    expect(page.getByRole("heading", { name: "Experience", level: 2 })).toBeInTheDocument();
    expect(page.getByText("Nothing under this heading prints yet.")).toBeInTheDocument();
  });

  it("says so when the id is not in the store", async () => {
    mount(() => jsonOf(aFilledStore()), "/resumes/01a00ff5-0000-7000-8000-000000000000");

    expect(await screen.findByText("No resume with that id")).toBeInTheDocument();
  });
});

describe("composing a resume", () => {
  function aComposedResume() {
    const store = aFilledStore();
    const resume = store.resumes[0];
    if (resume === undefined) throw new Error("the filled store holds a resume");
    return { store, server: storeServer(store), resumeId: resume.id };
  }

  function addFrom(label: string, option = "0"): void {
    const select = screen.getByLabelText(label);
    fireEvent.change(select, { target: { value: option } });
    const picker = select.closest("div");
    if (picker === null) throw new Error("the picker sits beside its select");
    fireEvent.click(within(picker).getByRole("button", { name: "Add" }));
  }

  function methods(server: ReturnType<typeof storeServer>): string[] {
    return server.calls.map((call) => call.method);
  }

  // The row that turns a drag into a full refetch: a composition write answers
  // with the row it wrote, so the boot payload takes that and is not re-read.
  it("toggles a point off with one request and no re-read", async () => {
    const { server, resumeId } = aComposedResume();
    mount(server.answer, `/resumes/${resumeId}`);

    await screen.findByText("Cut p95 latency from 800ms to 120ms");
    press("Stop printing Cut p95 latency from 800ms to 120ms");

    await waitFor(() => {
      expect(methods(server)).toEqual(["GET", "PATCH"]);
    });
    expect(await screen.findByText(/2 placed and toggled off/)).toBeInTheDocument();
  });

  it("moves an entry with one row, because the key is fractional", async () => {
    const { store, server, resumeId } = aComposedResume();
    const projects = store.resumeSections[1];
    if (projects === undefined) throw new Error("the filled store holds two sections");

    mount(server.answer, `/resumes/${resumeId}`);
    await screen.findByText("Difference Engine");
    press("Move Projects up");

    await waitFor(() => {
      const headings = screen.getAllByRole("heading", { level: 2 }).map((row) => row.textContent);
      expect(headings.slice(0, 2)).toEqual(["Projects", "Experience"]);
    });
    expect(methods(server)).toEqual(["GET", "PATCH"]);
    expect(store.resumeSections.find((row) => row.id === projects.id)?.sortKey).not.toBe("a1");
  });

  it("writes nothing when the move would put a row back where it is", async () => {
    const { server, resumeId } = aComposedResume();
    mount(server.answer, `/resumes/${resumeId}`);

    await screen.findByRole("heading", { name: "Experience", level: 2 });
    expect(screen.getByRole("button", { name: "Move Experience up" })).toBeDisabled();
  });

  // `resume_entry_record_unique` covers archived rows, so a second insert is
  // refused by the index: putting one back is a restore of the row that is
  // there.
  it("takes an entry off and puts the same row back", async () => {
    const { store, server, resumeId } = aComposedResume();
    mount(server.answer, `/resumes/${resumeId}`);

    await screen.findByText("Engine lead");
    press("Take Engine lead off this resume");
    await waitFor(() => {
      expect(screen.queryByText("Cut p95 latency from 800ms to 120ms")).not.toBeInTheDocument();
    });

    addFrom("Add a record to Experience");
    await waitFor(() => {
      expect(server.calls.some((call) => call.path.endsWith("/restore"))).toBe(true);
    });
    expect(store.resumeEntries).toHaveLength(2);
    expect(await screen.findByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
  });

  it("places a record and stops offering it", async () => {
    const { store, server, resumeId } = aComposedResume();
    addRecord(store, { kind: "experience", title: "Platform engineer" });

    mount(server.answer, `/resumes/${resumeId}`);
    await screen.findByText("Engine lead");
    addFrom("Add a record to Experience");

    expect(await screen.findByText("Platform engineer")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByLabelText("Add a record to Experience")).not.toBeInTheDocument();
    });
    expect(store.resumeEntries).toHaveLength(3);
  });

  // An entry point pins a phrasing rather than a set, so this changes what one
  // resume says and nothing else.
  it("chooses which wording this resume prints", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Canonical wording", { recordId: record.id });
    const angled = addPhrasing(store, point.phrasingSetId, "Angled for this application", {
      label: "for Acme",
      sortKey: "a1",
    });
    const resume = addResume(store, { name: "Angled" });
    addEntryPoint(store, addEntry(store, addSection(store, resume.id), record.id), point);
    const server = storeServer(store);

    mount(server.answer, `/resumes/${resume.id}`);
    fireEvent.change(await screen.findByLabelText("Wording for Canonical wording"), {
      target: { value: angled.id },
    });

    expect(await screen.findByText("Angled for this application")).toBeInTheDocument();
    expect(store.resumeEntryPoints[0]?.phrasingId).toBe(angled.id);
  });

  it("renames a section, and prints the kind's own heading again when emptied", async () => {
    const { server, resumeId } = aComposedResume();
    mount(server.answer, `/resumes/${resumeId}`);

    fireEvent.click(await screen.findByRole("button", { name: "Rename Experience" }));
    fireEvent.change(screen.getByLabelText("Heading for Experience"), {
      target: { value: "What I have done" },
    });
    press("Save");
    expect(
      await screen.findByRole("heading", { name: "What I have done", level: 2 }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rename What I have done" }));
    fireEvent.change(screen.getByLabelText("Heading for What I have done"), {
      target: { value: "  " },
    });
    press("Save");
    expect(
      await screen.findByRole("heading", { name: "Experience", level: 2 }),
    ).toBeInTheDocument();
  });

  // An override on top of the channel's own default, which is why following the
  // default again is a third choice and not the same as hiding it.
  it("overrides a contact channel, then follows its default again", async () => {
    const { store, server, resumeId } = aComposedResume();
    mount(server.answer, `/resumes/${resumeId}`);

    await screen.findByText("ada@example.org");
    press("Stop printing ada@example.org");
    await waitFor(() => {
      expect(store.resumeContactChannels).toHaveLength(1);
    });
    expect(store.resumeContactChannels[0]?.isVisible).toBe(false);

    press("Follow the default for ada@example.org");
    await waitFor(() => {
      expect(store.resumeContactChannels).toHaveLength(0);
    });
    expect(screen.queryByRole("button", { name: /Follow the default/ })).not.toBeInTheDocument();
  });
});

describe("a resume's history", () => {
  function aVersionedResume() {
    const store = aFilledStore();
    const resume = store.resumes[0];
    if (resume === undefined) throw new Error("the filled store holds a resume");
    return { store, server: storeServer(store), resumeId: resume.id };
  }

  it("saves a version, and saving again with nothing changed keeps one", async () => {
    const { server, resumeId } = aVersionedResume();
    mount(server.answer, `/resumes/${resumeId}?view=history`);

    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    const timeline = await screen.findByRole("list", { name: "Versions of this resume" });
    expect(await within(timeline).findByText("#1")).toBeInTheDocument();

    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(1);
    });
    expect(within(timeline).queryByText("#2")).not.toBeInTheDocument();
  });

  // The pinned wordings come back resolved, so reading what changed costs no
  // further request.
  it("compares two versions and shows the wording on both sides", async () => {
    const { store, server, resumeId } = aVersionedResume();
    const point = store.points[0];
    const phrasing = store.phrasings.find((row) => row.phrasingSetId === point?.phrasingSetId);
    if (phrasing === undefined) throw new Error("a point is written with the wording it holds");

    mount(server.answer, `/resumes/${resumeId}?view=history`);
    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(1);
    });

    addRevision(store, phrasing, "Cut p95 latency to 120ms");
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(2);
    });

    const changes = await screen.findByRole("list", { name: "What changed between these two" });
    expect(within(changes).getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(within(changes).getByText("Cut p95 latency to 120ms")).toBeInTheDocument();
    expect(within(changes).getByText("Wording")).toBeInTheDocument();
  });

  // Never rewinds: the restore is a third entry saying where it came from, and
  // what happened in between is still on the timeline.
  it("restores an older version by appending one that says where it came from", async () => {
    const { store, server, resumeId } = aVersionedResume();
    const point = store.points[0];
    const phrasing = store.phrasings.find((row) => row.phrasingSetId === point?.phrasingSetId);
    if (phrasing === undefined) throw new Error("a point is written with the wording it holds");

    mount(server.answer, `/resumes/${resumeId}?view=history`);
    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(1);
    });
    addRevision(store, phrasing, "Reworded since");
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(2);
    });

    const timeline = screen.getByRole("list", { name: "Versions of this resume" });
    const first = within(timeline).getByText("#1").closest("li");
    if (first === null) throw new Error("the timeline lists every version");
    fireEvent.click(within(first).getByRole("button", { name: "Restore" }));

    expect(await within(timeline).findByText("#3")).toBeInTheDocument();
    expect(within(timeline).getByText(/from #1/)).toBeInTheDocument();
    expect(within(timeline).getByText("Restored")).toBeInTheDocument();
    expect(within(timeline).getByText("#2")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Every column of a removed entry trivially differs, and the badge beside its
  // name already says so: listing them buries the one word that matters.
  it("names what left without listing every field of it", async () => {
    const { store, server, resumeId } = aVersionedResume();
    const entry = store.resumeEntries[0];
    if (entry === undefined) throw new Error("the filled store places a record");

    mount(server.answer, `/resumes/${resumeId}?view=history`);
    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(1);
    });

    entry.isVisible = false;
    press("Save a version");
    await waitFor(() => {
      expect(server.versions).toHaveLength(2);
    });

    const changes = await screen.findByRole("list", { name: "What changed between these two" });
    // The entry and the point that went with it, each named once.
    expect(within(changes).getAllByText("Removed")).toHaveLength(2);
    expect(within(changes).getByText("Engine lead")).toBeInTheDocument();
    expect(within(changes).getByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    expect(within(changes).queryByText("Title")).not.toBeInTheDocument();
    expect(within(changes).queryByText("nothing")).not.toBeInTheDocument();
  });

  // A snapshot is a version the user named, and it is an owned row rather than
  // a flag - so unstarring archives it and the label stops being shown.
  it("stars a version with a name, and unstars it again", async () => {
    const { server, resumeId } = aVersionedResume();
    mount(server.answer, `/resumes/${resumeId}?view=history`);

    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    await screen.findByRole("button", { name: "Star" });

    press("Star");
    type("A name for version 1", "What I sent Babbage");
    press("Save");

    expect(await screen.findByText("What I sent Babbage")).toBeInTheDocument();
    expect(server.snapshots).toHaveLength(1);

    press("Unstar");
    await waitFor(() => {
      expect(screen.queryByText("What I sent Babbage")).not.toBeInTheDocument();
    });
    expect(server.snapshots[0]?.archivedAt).not.toBeNull();
  });

  it("says so before anything has been saved", async () => {
    const { server, resumeId } = aVersionedResume();
    mount(server.answer, `/resumes/${resumeId}?view=history`);

    expect(await screen.findByText("Versions are what a resume said")).toBeInTheDocument();
    expect(screen.queryByLabelText("Compare from")).not.toBeInTheDocument();
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

describe("a resume and its template", () => {
  function aResumeToPrint() {
    const store = aFilledStore();
    const resume = store.resumes[0];
    if (resume === undefined) throw new Error("the filled store holds a resume");
    return { store, server: storeServer(store), resume };
  }

  function patched(server: ReturnType<typeof storeServer>): unknown[] {
    return server.calls.filter((call) => call.method === "PATCH").map((call) => call.body);
  }

  it("starts a resume from the list and opens it", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/resumes");

    await screen.findByText("No resumes yet");
    press("New resume");
    type("A name for the new resume", "Backend, Acme");
    press("Start it");

    expect(await screen.findByRole("heading", { name: "Backend, Acme" })).toBeInTheDocument();
    expect(server.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });

  // Every composition write is optimistic, so a refused one puts the row back
  // exactly as it was and the screen otherwise says nothing at all.
  it("says so when a composition write is refused", async () => {
    const { store, resume } = aResumeToPrint();

    mount((_url, init) => {
      if (init?.method === undefined || init.method === "GET") return jsonOf(store);
      return jsonOf(
        {
          type: "https://keepcv.app/problems/internal",
          title: "The store is unreachable",
          status: 500,
          detail: "Nothing was written.",
          instance: "/v1/resume-entries",
        },
        500,
      );
    }, `/resumes/${resume.id}?view=composition`);

    fireEvent.click(await screen.findByRole("button", { name: /^Stop printing Experience/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The store is unreachable");
  });

  it("renames a resume, archives it and puts it back", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}`);

    await screen.findByRole("heading", { name: resume.name });
    press("Rename this resume");
    type(`A name for ${resume.name}`, "Staff engineer, Babbage");
    press("Save");
    expect(
      await screen.findByRole("heading", { name: "Staff engineer, Babbage" }),
    ).toBeInTheDocument();

    press("Archive");
    expect(await screen.findByText("Archived, and kept")).toBeInTheDocument();

    press("Put back");
    await waitFor(() => {
      expect(screen.queryByText("Archived, and kept")).not.toBeInTheDocument();
    });
    expect(server.calls.map((call) => call.method)).toEqual(["GET", "PATCH", "DELETE", "POST"]);
  });

  // The template is a column on the resume, so tuning it is an ordinary write
  // and the preview recompiles from the cached store rather than asking again.
  it("tunes the template without a request per pixel", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    await printed();
    expect(screen.getByLabelText("Template")).toHaveValue("ats-single-column");
    expect(patched(server)).toHaveLength(0);

    type("Body size", "9");
    type("Body size", "12");

    await waitFor(
      () => {
        expect(patched(server)).toHaveLength(1);
      },
      { timeout: 2000 },
    );
    // Two changes, one write, carrying the second value: without the debounce
    // each would go out on its own and race the other's `updatedAt`.
    expect(patched(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: { templateId: "ats-single-column", templateConfig: { fontSize: 12 } },
    });
  });

  // An override is a difference from the old design's defaults, so carrying it
  // across would mean something else against the new one.
  it("switches template and drops the settings held against the old one", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    await printed();
    type("Template", "ats-left-heading");

    await waitFor(() => {
      expect(patched(server)).toHaveLength(1);
    });
    expect(patched(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: { templateId: "ats-left-heading", templateConfig: {} },
    });
  });

  // What the template is belongs to the template, which is what lets its
  // compliance notes be derived rather than claimed by hand.
  it("offers a resume what makes it fit, and no design setting", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    await printed();

    expect(await screen.findByLabelText("Body size")).toBeInTheDocument();
    expect(screen.getByLabelText("Page margin")).toBeInTheDocument();
    expect(screen.queryByLabelText("Section headings")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Accent")).not.toBeInTheDocument();
  });

  // The limit is a column on the resume, not a template setting, so it survives
  // a template swap and travels with the export.
  it("keeps how long the resume may be, and reads the length back", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    await printed();
    expect(screen.getByLabelText("How long it may be")).toHaveValue("");
    expect(screen.getByText(/^This is 1 page long\.$/)).toBeInTheDocument();

    type("How long it may be", "1");

    await waitFor(() => {
      expect(patched(server)).toHaveLength(1);
    });
    expect(patched(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: { pageLimit: 1 },
    });
    expect(await screen.findByText(/within the 1 page you asked for/)).toBeInTheDocument();
  });

  // The document was compiled in this tab, so the file is written from what the
  // browser already holds and the store is asked nothing.
  it("writes the resume out as one file, without a request for it", async () => {
    const { store, server, resume } = aResumeToPrint();
    const point = store.points[0];
    if (point === undefined) throw new Error("the filled store holds a point");
    addEvidence(store, point.id, { value: "https://private.test/salary-review" });

    const written: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      written.push(blob as Blob);
      return "blob:written";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    mount(server.answer, `/resumes/${resume.id}?view=preview`);
    await printed();
    press("Download HTML");

    expect(names).toEqual(["ada-lovelace-staff-engineer-2026.html"]);
    const file = written[0];
    if (file === undefined) throw new Error("the download wrote a file");

    const html = await file.text();
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("Cut p95 latency from 800ms to 120ms");
    // Structural, not filtered: `ResumeDocument` has no field evidence could
    // travel in, so no exporter can leak it even by mistake.
    expect(html).not.toContain("private.test");
    expect(server.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("writes the same selection as a page to put online", async () => {
    const { store, server, resume } = aResumeToPrint();
    const point = store.points[0];
    if (point === undefined) throw new Error("the filled store holds a point");
    addEvidence(store, point.id, { value: "https://private.test/salary-review" });

    const written: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      written.push(blob as Blob);
      return "blob:written";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    mount(server.answer, `/resumes/${resume.id}?view=preview`);
    await printed();
    press("Download personal page");

    // What every static host looks for, and not the name the resume takes.
    expect(names).toEqual(["index.html"]);
    const file = written[0];
    if (file === undefined) throw new Error("the download wrote a file");

    const html = await file.text();
    expect(html).toContain("Cut p95 latency from 800ms to 120ms");
    expect(html).toContain("prefers-color-scheme");
    // The page is the output that goes somewhere public, and it is the same
    // document, so evidence cannot reach it any more than it reaches a resume.
    expect(html).not.toContain("private.test");
    expect(server.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  it("writes it as JSON Resume, and says first what will not fit", async () => {
    const { store, server, resume } = aResumeToPrint();
    const point = store.points[0];
    if (point === undefined) throw new Error("the filled store holds a point");
    addEvidence(store, point.id, { value: "https://private.test/salary-review" });

    const written: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      written.push(blob as Blob);
      return "blob:written";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    mount(server.answer, `/resumes/${resume.id}?view=preview`);
    await printed();

    // Counted against this resume, and read before the file is written.
    expect(screen.getByText(/things? do(es)? not fit that format/)).toBeInTheDocument();

    press("Download JSON Resume");

    await waitFor(() => {
      expect(names).toEqual(["ada-lovelace-staff-engineer-2026.json"]);
    });
    const file = written[0];
    if (file === undefined) throw new Error("the download wrote a file");

    const parsed = JSON.parse(await file.text()) as {
      basics: { name: string };
      work: { position: string; highlights: string[] }[];
    };
    expect(parsed.basics.name).toBe("Ada Lovelace");
    expect(parsed.work[0]?.highlights).toContain("Cut p95 latency from 800ms to 120ms");
    expect(await file.text()).not.toContain("private.test");
    expect(server.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  // One control for four formats, and the loss list tracks it: a panel that
  // named a cost for the format the user is not downloading is worse than none.
  it("writes it in a typesetting format, and re-counts the cost when the format changes", async () => {
    const { server, resume } = aResumeToPrint();

    const written: Blob[] = [];
    const names: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      written.push(blob as Blob);
      return "blob:written";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    mount(server.answer, `/resumes/${resume.id}?view=preview`);
    await printed();

    // JSON Resume drops metrics and a custom section; a Typst file this resume
    // fits entirely, and saying so is the point of counting per format.
    expect(screen.getByText(/not fit that format/)).toBeInTheDocument();
    type("Somebody else's format", "typst");
    expect(screen.getByText("Everything in this resume fits that format.")).toBeInTheDocument();

    press("Download Typst source");

    // Awaited: a Word document needs the zip writer fetched first, so writing
    // any of these settles a promise rather than happening under the click.
    await waitFor(() => {
      expect(names).toEqual(["ada-lovelace-staff-engineer-2026.typ"]);
    });
    const file = written[0];
    if (file === undefined) throw new Error("the download wrote a file");

    const source = await file.text();
    expect(source.startsWith("#set page(")).toBe(true);
    expect(source).toContain("Cut p95 latency from 800ms to 120ms");
    expect(source).not.toContain("private.test");
    expect(server.calls.filter((call) => call.method !== "GET")).toEqual([]);
  });

  // The browser is the PDF writer: the template's stylesheet already states the
  // page box and the break rules the print engine needs.
  it("hands that same file to the print engine", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    await printed();
    press("Print or save as PDF");

    const sent = window.document.querySelector<HTMLIFrameElement>('iframe[aria-hidden="true"]');
    expect(sent?.srcdoc).toContain("Cut p95 latency from 800ms to 120ms");
  });

  const lintPanel = async () => await screen.findByRole("region", { name: "How it reads" });

  it("reads the file back the way a machine would, and says so", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    expect(await lintPanel()).toHaveTextContent("Nothing here trips a reader");
  });

  // A resume with no way to reach the person on it passes every other check in
  // the app and is the one thing a machine reading it cannot do without.
  it("names what a machine would not get from it", async () => {
    const { store, server, resume } = aResumeToPrint();
    store.contactChannels = [];

    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    const panel = await lintPanel();
    expect(panel).toHaveTextContent("Will break");
    expect(panel).toHaveTextContent("No email address anywhere");
    expect(panel).toHaveTextContent("not a claim of compatibility with any product");
  });

  it("says what the template does rather than claiming a certification", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=preview`);

    expect(await screen.findByRole("region", { name: "How it looks" })).toHaveTextContent(
      /never images or table cells/,
    );
  });

  // Beside the composition the preview is feedback on what was just placed, and
  // a panel of export and template controls opens over the thing it changes.
  it("offers export and template settings on the preview but not on the composition", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=composition`);

    await printed();
    expect(screen.queryByRole("button", { name: /Export and settings/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print or save as PDF" })).not.toBeInTheDocument();
  });

  const POSTING = "We use Kubernetes and Terraform. Kubernetes above all.";

  it("keeps the posting, then measures the resume against it", async () => {
    const { server, resume } = aResumeToPrint();
    mount(server.answer, `/resumes/${resume.id}?view=target`);

    expect(await screen.findByLabelText("Company")).toHaveValue("Babbage Ltd");
    expect(screen.getByLabelText("Role")).toHaveValue("Staff engineer");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    type("Job description", POSTING);
    press("Save");

    await waitFor(() => {
      expect(patched(server)).toHaveLength(1);
    });
    // The whole form, not only the box that changed: absent would leave the
    // stored value alone, and Revert has to be able to clear one.
    expect(patched(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: {
        targetCompany: "Babbage Ltd",
        targetRole: "Staff engineer",
        targetUrl: null,
        appliedOn: "2026-02-10",
        targetJdText: POSTING,
      },
    });

    // The role counts as part of the posting, so four terms are asked for:
    // only "engineer" lands, through the record the entry prints.
    expect(await screen.findByText("1 of 4 answered")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Terraform")).toBeInTheDocument();
  });

  it("takes the point that answers least off the page, without deleting it", async () => {
    const { server, store, resume } = aResumeToPrint();
    const placed = store.resumeEntryPoints.filter((row) => row.isVisible);
    mount(server.answer, `/resumes/${resume.id}?view=target`);

    await screen.findByLabelText("Job description");
    type("Job description", POSTING);
    press("Save");

    expect(await screen.findByText("Cut p95 latency from 800ms to 120ms")).toBeInTheDocument();
    // Named with the record it sits under: one wording can be placed on three
    // jobs, and the list cannot be acted on without saying which this is.
    expect(screen.getByText("Engine lead - Answers engineer.")).toBeInTheDocument();
    press("Take off the page");

    await waitFor(() => {
      expect(patched(server)).toHaveLength(2);
    });
    expect(patched(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: { isVisible: false },
    });
    // Still on the resume, and still holding where it sat.
    expect(store.resumeEntryPoints).toHaveLength(placed.length + 1);
  });

  it("offers both sides when the resume changed under a posting being written", async () => {
    const store = aFilledStore();
    const resume = store.resumes[0];
    if (resume === undefined) throw new Error("the filled store holds a resume");
    const server = storeServer(store, (call) =>
      call.method === "PATCH"
        ? jsonOf(
            {
              type: "https://keepcv.app/problems/stale-write",
              title: "Stale write",
              status: 409,
              detail: "the resume changed after it was read",
              instance: `/v1/resumes/${resume.id}`,
              current: { ...resume, targetCompany: "Babbage and Sons" },
            },
            409,
          )
        : undefined,
    );

    mount(server.answer, `/resumes/${resume.id}?view=target`);
    expect(await screen.findByLabelText("Company")).toHaveValue("Babbage Ltd");
    type("Company", "Babbage Ltd, Soho");
    press("Save");

    expect(
      await screen.findByText("This resume changed while you were editing it"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Babbage Ltd, Soho/)).toBeInTheDocument();
    expect(screen.getByText(/Babbage and Sons/)).toBeInTheDocument();
    expect(store.resumes[0]?.targetCompany).toBe("Babbage Ltd");
  });
});

describe("designs of your own", () => {
  const sent = (server: ReturnType<typeof storeServer>, method: string): unknown[] =>
    server.calls.filter((call) => call.method === method).map((call) => call.body);
  const posted = (server: ReturnType<typeof storeServer>) => sent(server, "POST");
  const patchedBodies = (server: ReturnType<typeof storeServer>) => sent(server, "PATCH");

  // The shipped ones are in every build rather than in the store, so a store
  // that holds none of its own still has something for a resume to name.
  it("lists the shipped designs beside yours", async () => {
    const store = emptyStore();
    addTemplate(store, "Navy headings", { settings: { accent: "navy" } });
    mount(() => jsonOf(store), "/templates");

    expect(await screen.findByText("Single column")).toBeInTheDocument();
    expect(screen.getByText("Left headings")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Navy headings" })).toBeInTheDocument();
    expect(screen.getAllByText("Built in")).toHaveLength(2);
    expect(screen.getByText("3 designs")).toBeInTheDocument();
  });

  it("starts one from a design that already exists", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/templates");

    await screen.findByText("Single column");
    press("New design");
    type("Name", "Navy headings");
    type("Based on", "ats-left-heading");
    press("Start it");

    await waitFor(() => {
      expect(posted(server)).toHaveLength(1);
    });
    expect(posted(server).at(-1)).toMatchObject({
      name: "Navy headings",
      spec: { settings: { headingPlace: "beside" }, extraCss: "" },
    });
  });

  // The file is read in the tab and the store is asked to write a design, so a
  // design travels between two stores without either one reaching the other.
  it("starts one from a design saved out as a file", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/templates");

    await screen.findByText("Single column");
    press("New design");
    load("Or load one from a file", {
      name: "Navy headings",
      spec: { settings: { accent: "navy" }, extraCss: ".kc-name { letter-spacing: 0; }" },
    });

    // The name comes off the file, so a design that was named once stays named.
    expect(await screen.findByLabelText<HTMLInputElement>("Name")).toHaveValue("Navy headings");
    press("Start it");

    await waitFor(() => {
      expect(posted(server)).toHaveLength(1);
    });
    expect(posted(server).at(-1)).toMatchObject({
      name: "Navy headings",
      spec: { settings: { accent: "navy" } },
    });
  });

  it("turns away a file that is not a design, and writes nothing", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/templates");

    await screen.findByText("Single column");
    press("New design");
    load("Or load one from a file", { basics: { name: "Ada" } });

    expect(await screen.findByText(/is not a design/)).toBeInTheDocument();
    expect(posted(server)).toHaveLength(0);
  });

  // `template_name_unique` covers archived rows, so the clash is named here
  // rather than left to the store to refuse after the form has been filled in.
  it("says so before writing when the name is already taken", async () => {
    const store = emptyStore();
    addTemplate(store, "Navy headings");
    const server = storeServer(store);
    mount(server.answer, "/templates");

    await screen.findByText("Single column");
    press("New design");
    type("Name", "Navy headings");

    expect(
      await screen.findByText("A design of yours is already called that."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start it/ })).toBeDisabled();
  });

  it("writes a design knob as it is moved, once the moving stops", async () => {
    const store = emptyStore();
    const template = addTemplate(store, "Navy headings");
    const server = storeServer(store);
    mount(server.answer, `/templates/${template.id}`);

    await screen.findByRole("heading", { name: "Navy headings" });
    type("Accent", "navy");
    type("Accent", "forest");

    await waitFor(
      () => {
        expect(patchedBodies(server)).toHaveLength(1);
      },
      { timeout: 2000 },
    );
    expect(patchedBodies(server).at(-1)).toEqual({
      expectedUpdatedAt: expect.any(String),
      patch: { spec: { settings: { accent: "forest" }, extraCss: "" } },
    });
  });

  // A stylesheet that fetches is a resume that prints differently offline, so
  // the refusal is the schema's rather than a lint after the fact.
  it("refuses CSS that would fetch, and writes nothing while it is wrong", async () => {
    const store = emptyStore();
    const template = addTemplate(store, "Navy headings");
    const server = storeServer(store);
    mount(server.answer, `/templates/${template.id}`);

    await screen.findByRole("heading", { name: "Navy headings" });
    type("Extra CSS", "@import url(https://fonts.example.test/a.css);");

    expect(await screen.findByText(/may not fetch anything/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(patchedBodies(server)).toHaveLength(0);
  });

  // A select holding a value no option carries reads as a resume printing
  // through some other design, and moving off it cannot be undone.
  it("keeps offering an archived design to the resume still printing with it", async () => {
    const store = aFilledStore();
    const resume = store.resumes[0];
    const template = addTemplate(store, "Navy headings", {}, { archivedAt: EPOCH_ISO });
    if (resume === undefined) throw new Error("the filled store holds a resume");
    resume.templateId = template.id;
    mount(() => jsonOf(store), `/resumes/${resume.id}?view=preview`);

    const picker = await screen.findByLabelText<HTMLSelectElement>("Template");
    expect(picker.value).toBe(template.id);
    expect([...picker.options].map((option) => option.text)).toContain("Navy headings (archived)");
  });

  it("offers a design of yours to a resume, and links through to it", async () => {
    const store = aFilledStore();
    const resume = store.resumes[0];
    const template = addTemplate(store, "Navy headings");
    if (resume === undefined) throw new Error("the filled store holds a resume");
    resume.templateId = template.id;
    mount(() => jsonOf(store), `/resumes/${resume.id}?view=preview`);

    const picker = await screen.findByLabelText<HTMLSelectElement>("Template");
    expect([...picker.options].map((option) => option.text)).toContain("Navy headings");
    expect(picker.value).toBe(template.id);
    expect(screen.getByRole("link", { name: "Change what this design is" })).toHaveAttribute(
      "href",
      `/templates/${template.id}`,
    );
  });
});

describe("the tag vocabulary", () => {
  // Every row carries the same controls, so a click has to be aimed at one.
  async function rowFor(label: string): Promise<HTMLElement> {
    const row = (await screen.findByText(label)).closest("li");
    if (row === null) throw new Error(`no row for ${label}`);
    return row;
  }

  function aTaggedStore() {
    const store = emptyStore();
    const record = addRecord(store, { title: "Ledger rewrite" });
    const point = addPoint(store, "Ran it in anger", { recordId: record.id });
    return { store, record, point };
  }

  it("files a record under a word nobody has used yet, creating the tag in one motion", async () => {
    const { store, record } = aTaggedStore();
    const server = storeServer(store);
    mount(server.answer, `/records/${record.id}`);

    await screen.findByLabelText("Add a tag");
    type("Add a tag", "Kubernetes");
    press("Add");

    expect(await screen.findByRole("button", { name: "Take Kubernetes off" })).toBeInTheDocument();
    expect(server.calls.map((call) => `${call.method} ${call.path}`)).toContain("POST /v1/tags");
    expect(store.tags[0]?.slug).toBe("kubernetes");
    expect(store.recordTags).toHaveLength(1);
  });

  // Two labels that slug alike are one tag, and the store would refuse the
  // second: the picker has to reach for what is there rather than send it.
  it("reaches for the tag that already exists rather than making a second one", async () => {
    const { store, point } = aTaggedStore();
    const kubernetes = addTag(store, "Kubernetes");
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    await screen.findByLabelText("Add a tag");
    type("Add a tag", "kubernetes");
    press("Add");

    expect(await screen.findByRole("button", { name: "Take Kubernetes off" })).toBeInTheDocument();
    expect(server.calls.filter((call) => call.method !== "GET")).toEqual([
      { method: "PUT", path: `/v1/points/${point.id}/tags/${kubernetes.id}`, body: undefined },
    ]);
    expect(store.tags).toHaveLength(1);
  });

  it("takes a tag off without archiving either end", async () => {
    const { store, record } = aTaggedStore();
    const kubernetes = addTag(store, "Kubernetes");
    store.recordTags.push({ tagId: kubernetes.id, recordId: record.id });
    const server = storeServer(store);
    mount(server.answer, `/records/${record.id}`);

    fireEvent.click(await screen.findByRole("button", { name: "Take Kubernetes off" }));

    await waitFor(() => {
      expect(store.recordTags).toEqual([]);
    });
    expect(store.tags).toHaveLength(1);
    expect(store.records[0]?.archivedAt).toBeNull();
  });

  it("narrows the record list to one tag, and says which", async () => {
    const { store, record } = aTaggedStore();
    addRecord(store, { title: "Untagged work" });
    const kubernetes = addTag(store, "Kubernetes");
    store.recordTags.push({ tagId: kubernetes.id, recordId: record.id });

    mount(() => jsonOf(store), `/records?tag=${kubernetes.id}`);

    expect(await screen.findByText("Ledger rewrite")).toBeInTheDocument();
    expect(screen.queryByText("Untagged work")).not.toBeInTheDocument();
    expect(screen.getByText("Filed under")).toBeInTheDocument();
  });

  // The merge is the reason the vocabulary is manageable at all: it moves what
  // the losing tag carried rather than dropping it with the name.
  it("merges one tag into another and moves everything it carried", async () => {
    const { store, record, point } = aTaggedStore();
    const k8s = addTag(store, "k8s");
    const kubernetes = addTag(store, "Kubernetes");
    store.recordTags.push({ tagId: k8s.id, recordId: record.id });
    store.pointTags.push(
      { tagId: k8s.id, pointId: point.id },
      { tagId: kubernetes.id, pointId: point.id },
    );
    const server = storeServer(store);
    mount(server.answer, "/tags");

    const row = within(await rowFor("k8s"));
    fireEvent.click(row.getByRole("button", { name: "Merge" }));
    fireEvent.change(screen.getByLabelText("Merge k8s into"), {
      target: { value: kubernetes.id },
    });
    press("Merge and archive k8s");

    await waitFor(() => {
      expect(store.tags.find((tag) => tag.id === k8s.id)?.archivedAt).not.toBeNull();
    });
    expect(store.recordTags).toEqual([{ tagId: kubernetes.id, recordId: record.id }]);
    // The point carried both, so it keeps the one it had rather than gaining a
    // second row the uniqueness index would refuse.
    expect(store.pointTags).toEqual([{ tagId: kubernetes.id, pointId: point.id }]);
  });

  it("renames a tag, and the slug follows the name", async () => {
    const { store } = aTaggedStore();
    addTag(store, "kuberentes");
    const server = storeServer(store);
    mount(server.answer, "/tags");

    fireEvent.click(await screen.findByRole("button", { name: "Rename" }));
    type("Name", "Kubernetes");
    press("Save");

    await waitFor(() => {
      expect(store.tags[0]?.label).toBe("Kubernetes");
    });
    expect(store.tags[0]?.slug).toBe("kubernetes");
  });
});

describe("what backs a point up", () => {
  it("adds evidence to a point and keeps it out of what prints", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency from 800ms to 120ms");
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    await screen.findByLabelText("Kind");
    type("Link", "https://reviews.test/q3");
    type("Why it matters", "named as the reason it landed");
    press("Add evidence");

    expect(await screen.findByRole("link", { name: "https://reviews.test/q3" })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
    expect(screen.getByText("named as the reason it landed")).toBeInTheDocument();
    expect(store.evidence).toHaveLength(1);
    expect(store.evidence[0]).toMatchObject({ kind: "url", pointId: point.id });
  });

  // Evidence is private structurally, not by a filter: there is no field on
  // `ResumeDocument` it could travel in, and this is the test that says so.
  it("never reaches the compiled document", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Cut p95 latency", { recordId: record.id });
    addEvidence(store, point.id);
    const resume = addResume(store, { name: "Staff engineer" });
    const section = addSection(store, resume.id);
    addEntryPoint(store, addEntry(store, section, record.id), point);

    mount(() => jsonOf(store), `/resumes/${resume.id}?view=preview`);

    const page = await printed();
    expect(page.getByText("Cut p95 latency")).toBeInTheDocument();
    expect(page.queryByText(/private\.test/)).not.toBeInTheDocument();
    expect(JSON.stringify(compile(store, resume.id, { generatedAt: EPOCH_ISO }))).not.toContain(
      "private.test",
    );
  });

  it("removes a piece of evidence by archiving it, never by deleting", async () => {
    const store = emptyStore();
    const point = addPoint(store, "Cut p95 latency");
    addEvidence(store, point.id, { kind: "note", value: "Told me in the Q3 review" });
    const server = storeServer(store);
    mount(server.answer, `/points/${point.id}/edit`);

    expect(await screen.findByText("Told me in the Q3 review")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "remove" }));

    // Off the screen and still in the store: the row is archived, not deleted,
    // and an archived one must not keep rendering.
    await waitFor(() => {
      expect(screen.queryByText("Told me in the Q3 review")).not.toBeInTheDocument();
    });
    expect(store.evidence).toHaveLength(1);
    expect(store.evidence[0]?.archivedAt).not.toBeNull();
  });
});

describe("the profile", () => {
  it("puts a name on the store, which is what every resume header prints", async () => {
    const store = emptyStore();
    const server = storeServer(store);
    mount(server.answer, "/profile");

    await screen.findByLabelText("Name");
    type("Name", "Ada Lovelace");
    type("Headline", "Engine lead");
    press("Save");

    await waitFor(() => {
      expect(store.profile.fullName).toBe("Ada Lovelace");
    });
    expect(store.profile.headline).toBe("Engine lead");
  });

  it("says nothing was saved when the profile changed underneath, and keeps both", async () => {
    const store = emptyStore();
    store.profile.fullName = "Ada Lovelace";
    const server = storeServer(store, (call) =>
      call.method === "PATCH"
        ? jsonOf(
            {
              type: "https://keepcv.app/problems/conflict",
              title: "Conflict",
              status: 409,
              detail: "The profile changed.",
              instance: "/v1/profile",
              current: { ...store.profile, fullName: "A. Lovelace" },
            },
            409,
          )
        : undefined,
    );
    mount(server.answer, "/profile");

    await screen.findByLabelText("Name");
    type("Name", "Ada Byron");
    press("Save");

    expect(
      await screen.findByText("The profile changed while you were editing it"),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Byron")).toBeInTheDocument();
    expect(screen.getByText("A. Lovelace")).toBeInTheDocument();
    expect(store.profile.fullName).toBe("Ada Lovelace");
  });

  it("adds a way to be reached, as it is typed", async () => {
    const store = emptyStore();
    const server = storeServer(store);
    mount(server.answer, "/profile");

    await screen.findByLabelText("Value");
    type("Value", "ada@example.org");
    press("Add a way to reach you");

    await waitFor(() => {
      expect(store.contactChannels).toHaveLength(1);
    });
    expect(store.contactChannels[0]).toMatchObject({
      kind: "email",
      value: "ada@example.org",
      isDefaultVisible: true,
    });
  });

  // The rule the linter fires on, said where it can still be acted on rather
  // than on the preview screen after the resume is built.
  it("names the contact kinds a machine reading the resume would want", async () => {
    mount(() => jsonOf(emptyStore()), "/profile");

    expect(await screen.findByText(/No email and no phone yet/)).toBeInTheDocument();
  });

  it("does not nag once both are there", async () => {
    const store = emptyStore();
    addContactChannel(store, "email", "ada@example.org");
    addContactChannel(store, "phone", "+44 20 7946 0000", { sortKey: "a1" });
    mount(() => jsonOf(store), "/profile");

    expect(await screen.findByText("ada@example.org")).toBeInTheDocument();
    expect(screen.queryByText(/yet\./)).not.toBeInTheDocument();
  });

  // "A resume with neither" is only true while both are missing, and the first
  // real store this was tried on had an email.
  it("stops saying neither once one of the two is there", async () => {
    const store = emptyStore();
    addContactChannel(store, "email", "ada@example.org");
    mount(() => jsonOf(store), "/profile");

    expect(await screen.findByText(/No phone yet/)).toBeInTheDocument();
    expect(screen.queryByText(/with neither/)).not.toBeInTheDocument();
  });

  // A summary is a phrasing set like a point's, so it has to be made before
  // there is anywhere to type: the profile names a set rather than holding
  // text.
  it("starts a summary by making the set the profile names", async () => {
    const store = emptyStore();
    const server = storeServer(store);
    mount(server.answer, "/profile");

    await screen.findByRole("button", { name: "Write a summary" });
    press("Write a summary");

    await waitFor(() => {
      expect(store.profile.summarySetId).not.toBeNull();
    });
    expect(store.phrasingSets).toHaveLength(1);
    expect(store.phrasingSets[0]?.purpose).toBe("profile_summary");
    expect(await screen.findByLabelText("Wording, standard")).toBeInTheDocument();
  });

  it("archives a contact channel rather than deleting it", async () => {
    const store = emptyStore();
    addContactChannel(store, "email", "ada@example.org");
    const server = storeServer(store);
    mount(server.answer, "/profile");

    await screen.findByText("ada@example.org");
    press("Archive");

    await waitFor(() => {
      expect(store.contactChannels[0]?.archivedAt).not.toBeNull();
    });
    expect(store.contactChannels).toHaveLength(1);
  });
});

// jsdom implements no `dataTransfer`, which is exactly why the row being
// dragged lives in React state instead.
function dragOnto(from: HTMLElement, to: HTMLElement): void {
  fireEvent.dragStart(from);
  fireEvent.dragOver(to);
  fireEvent.drop(to);
  fireEvent.dragEnd(from);
}

function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest("li");
  if (row === null) throw new Error(`no row holding ${text}`);
  return row;
}

describe("ordering", () => {
  it("writes one row when a record is dragged onto another", async () => {
    const store = emptyStore();
    const first = addRecord(store, { kind: "project", title: "Difference Engine" });
    addRecord(store, { kind: "project", title: "Analytical Engine", sortKey: "a1" });
    const server = storeServer(store);
    mount(server.answer, "/records?kind=project");

    await screen.findByText("Difference Engine");
    dragOnto(rowOf("Difference Engine"), rowOf("Analytical Engine"));

    await waitFor(() => {
      expect(store.records[0]?.sortKey).not.toBe("a0");
    });
    expect(store.records[0]?.id).toBe(first.id);
    expect(store.records[1]?.sortKey).toBe("a1");
    // One row, because the key is fractional: a move must not rewrite the list.
    expect(server.calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  });

  it("writes nothing when a row is dropped on itself", async () => {
    const store = emptyStore();
    addRecord(store, { kind: "project", title: "Difference Engine" });
    addRecord(store, { kind: "project", title: "Analytical Engine", sortKey: "a1" });
    const server = storeServer(store);
    mount(server.answer, "/records?kind=project");

    await screen.findByText("Difference Engine");
    dragOnto(rowOf("Difference Engine"), rowOf("Difference Engine"));

    expect(server.calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
  });

  // A custom entry is scoped by the section it prints under, so two headings
  // are two lists: one of them would otherwise collide on
  // `record_sort_key_unique`.
  it("keeps custom entries in a list per heading", async () => {
    const store = emptyStore();
    const patents = addCustomSection(store, "Patents");
    const exhibits = addCustomSection(store, "Exhibitions", { sortKey: "a1" });
    addRecord(store, { kind: "custom_entry", title: "A patent", customSectionId: patents });
    addRecord(store, { kind: "custom_entry", title: "A show", customSectionId: exhibits });

    mount(() => jsonOf(store), "/records?kind=custom_entry");

    expect(await screen.findByText("Patents")).toBeInTheDocument();
    expect(screen.getByText("Exhibitions")).toBeInTheDocument();
    expect(rowOf("A patent").parentElement).not.toBe(rowOf("A show").parentElement);
  });

  it("orders a record's points by keyboard as well as by dragging", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    addPoint(store, "Cut p95 latency", { recordId: record.id });
    addPoint(store, "Rewrote the scheduler", { recordId: record.id, sortKey: "a1" });
    const server = storeServer(store);
    mount(server.answer, `/records/${record.id}`);

    await screen.findByText("Cut p95 latency");
    press("Move Rewrote the scheduler up");

    await waitFor(() => {
      expect(store.points[1]?.sortKey).not.toBe("a1");
    });
    expect(String(store.points[1]?.sortKey) < "a0").toBe(true);
  });

  it("drags a section of a resume above the one over it", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const resume = addResume(store, { name: "Staff engineer" });
    const experience = addSection(store, resume.id);
    addEntry(store, experience, record.id);
    addSection(store, resume.id, { kind: "project", sortKey: "a1" });
    const server = storeServer(store);
    mount(server.answer, `/resumes/${resume.id}`);

    const held = (await screen.findByRole("heading", { name: "Projects" })).closest(
      "div[draggable]",
    );
    const target = screen.getByRole("heading", { name: "Experience" }).closest("div[draggable]");
    if (held === null || target === null) throw new Error("no draggable section");
    dragOnto(held as HTMLElement, target as HTMLElement);

    await waitFor(() => {
      expect(store.resumeSections[1]?.sortKey).not.toBe("a1");
    });
    expect(String(store.resumeSections[1]?.sortKey) < "a0").toBe(true);
  });
});

describe("starting a resume from another", () => {
  it("copies the selection and opens the copy", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Cut p95 latency", { recordId: record.id });
    const resume = addResume(store, { name: "Staff engineer", targetCompany: "Babbage Ltd" });
    addEntryPoint(store, addEntry(store, addSection(store, resume.id), record.id), point);
    const server = storeServer(store);
    mount(server.answer, "/resumes");

    await screen.findByText("Staff engineer");
    press("Start a resume from Staff engineer");
    press("Start it");

    await waitFor(() => {
      expect(store.resumes).toHaveLength(2);
    });
    const copy = store.resumes[1];
    expect(copy?.name).toBe("Staff engineer copy");
    // The posting does not come across: the copy is aimed at a different
    // opening.
    expect(copy?.targetCompany).toBeNull();
    expect(store.resumeSections.filter((row) => row.resumeId === copy?.id)).toHaveLength(1);
    expect(store.resumeEntryPoints.filter((row) => row.resumeId === copy?.id)).toHaveLength(1);
    // The source is read, never moved.
    expect(store.resumeEntries.filter((row) => row.resumeId === resume.id)).toHaveLength(1);
  });
});

describe("sending an old version", () => {
  // A version is a file the same way the working resume is. Restoring it first
  // would rewrite the working composition to send something already sent.
  it("compiles a version in the words it pinned, without restoring anything", async () => {
    const store = emptyStore();
    const record = addRecord(store, { kind: "experience", title: "Engine lead" });
    const point = addPoint(store, "Cut p95 latency", { recordId: record.id });
    const resume = addResume(store, { name: "Staff engineer" });
    addEntryPoint(store, addEntry(store, addSection(store, resume.id), record.id), point);
    const server = storeServer(store);
    mount(server.answer, `/resumes/${resume.id}?view=history`);

    await screen.findByRole("button", { name: "Save a version" });
    press("Save a version");
    await screen.findByText("#1");
    press("Export");

    expect(await screen.findByRole("button", { name: "Download HTML" })).toBeInTheDocument();
    expect(screen.getByText(/Version #1, in the words it pinned/)).toBeInTheDocument();
    // Nothing was restored: the composition is exactly what it was.
    expect(server.calls.some((call) => call.path.endsWith("/restore"))).toBe(false);
  });
});

describe("your data", () => {
  // The archive rather than the boot payload: a backup carries superseded
  // wordings and every version, which `/v1/store` deliberately does not.
  it("reads the export rather than the payload the app already holds", async () => {
    const store = aFilledStore();
    const server = storeServer(store);
    const downloaded: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:kept");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded.push(this.download);
    });
    mount(server.answer, "/data");

    await screen.findByRole("button", { name: "Download a backup" });
    press("Download a backup");

    await waitFor(() => {
      expect(downloaded).toHaveLength(1);
    });
    expect(downloaded[0]).toMatch(/^keepcv-\d{4}-\d{2}-\d{2}\.json$/);
    expect(server.calls.some((call) => call.path === "/v1/export")).toBe(true);
  });

  it("counts what a backup would carry rather than promising everything", async () => {
    mount(() => jsonOf(aFilledStore()), "/data");

    expect(
      await screen.findByText(/Currently 2 records, 3 points, 1 resume\./),
    ).toBeInTheDocument();
  });

  it("says a load will be refused while the store still holds something", async () => {
    mount(() => jsonOf(aFilledStore()), "/data");

    expect(
      await screen.findByText(/already holds something, so a load will be refused/),
    ).toBeInTheDocument();
  });

  it("offers to load straight in when nothing has been written yet", async () => {
    mount(() => jsonOf(emptyStore()), "/data");

    expect(
      await screen.findByText(/empty, so a backup will load straight into it/),
    ).toBeInTheDocument();
  });

  // The store refuses an import over a profile someone has filled in, so a
  // screen promising the load would work is a screen that lies.
  it("counts a filled-in profile as something written", async () => {
    const store = emptyStore();
    store.profile.fullName = "Ada Lovelace";
    mount(() => jsonOf(store), "/data");

    expect(await screen.findByText(/already holds something/)).toBeInTheDocument();
    expect(screen.getByText(/Just the profile so far/)).toBeInTheDocument();
  });
});

describe("saved filters", () => {
  it("keeps the list you are looking at under a name", async () => {
    const store = aFilledStore();
    const server = storeServer(store);
    mount(server.answer, "/records?kind=project&archived=only");

    await screen.findByRole("button", { name: "Save this filter" });
    press("Save this filter");
    type("A name for this filter", "Shelved projects");
    press("Save");

    await waitFor(() => {
      expect(store.savedFilters).toHaveLength(1);
    });
    expect(store.savedFilters[0]).toMatchObject({
      name: "Shelved projects",
      subject: "record",
      kind: "project",
      archived: "only",
      unfinished: null,
    });
  });

  // The four values one control holds are stored apart, so a row says what it
  // means rather than repeating a widget's vocabulary.
  it("stores what a point filter means, not the name of the control", async () => {
    const store = aFilledStore();
    const server = storeServer(store);
    mount(server.answer, "/points?filter=unmeasured");

    await screen.findByRole("button", { name: "Save this filter" });
    press("Save this filter");
    type("A name for this filter", "Needs a number");
    press("Save");

    await waitFor(() => {
      expect(store.savedFilters).toHaveLength(1);
    });
    expect(store.savedFilters[0]).toMatchObject({
      subject: "point",
      unfinished: "unmeasured",
      archived: "exclude",
      kind: null,
    });
  });

  // The box replaces the button that was just clicked, so it appears under the
  // cursor: one that is not focused reads as broken, which it did in a browser.
  it("puts the cursor in the name box it just opened", async () => {
    mount(() => jsonOf(aFilledStore()), "/records");

    await screen.findByRole("button", { name: "Save this filter" });
    press("Save this filter");

    expect(screen.getByLabelText("A name for this filter")).toHaveFocus();
  });

  it("offers a saved one as a way back to that list", async () => {
    const store = aFilledStore();
    addSavedFilter(store, "Shelved projects", { kind: "project", archived: "only" });
    mount(() => jsonOf(store), "/records");

    const chip = await screen.findByRole("link", { name: "Shelved projects" });
    expect(chip).toHaveAttribute("href", expect.stringContaining("kind=project"));
    expect(chip).toHaveAttribute("href", expect.stringContaining("archived=only"));
  });

  it("says the list is already saved rather than offering to save it twice", async () => {
    const store = aFilledStore();
    addSavedFilter(store, "Shelved projects", { kind: "project", archived: "only" });
    mount(() => jsonOf(store), "/records?kind=project&archived=only");

    expect(await screen.findByText("Saved as Shelved projects")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save this filter" })).not.toBeInTheDocument();
  });

  it("forgets one by archiving it, never by deleting", async () => {
    const store = aFilledStore();
    addSavedFilter(store, "Shelved projects", { kind: "project", archived: "only" });
    const server = storeServer(store);
    mount(server.answer, "/records");

    await screen.findByRole("link", { name: "Shelved projects" });
    press("Forget Shelved projects");

    await waitFor(() => {
      expect(store.savedFilters[0]?.archivedAt).not.toBeNull();
    });
    expect(store.savedFilters).toHaveLength(1);
  });
});

// A file the browser reads and never uploads: what the store is asked to write
// is the reviewed intake, not the resume it came out of.
function chooseFile(body: string, name = "resume.json"): void {
  const input = screen.getByLabelText("A resume to read");
  const file = new File([body], name, { type: "application/json" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

const A_RESUME = JSON.stringify({
  basics: {
    name: "Ada Lovelace",
    email: "ada@example.org",
    summary: "Ships measurable work.",
  },
  work: [
    {
      name: "Acme",
      position: "Staff engineer",
      startDate: "2023-04",
      highlights: ["Cut runtime by 40%.", "Led the migration."],
    },
  ],
  education: [{ institution: "UCL", studyType: "BSc", startDate: "bad-date" }],
});

describe("bringing a resume in", () => {
  it("shows what the file held before anything is written", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile(A_RESUME);

    expect(await screen.findByText("Staff engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("ada@example.org")).toBeInTheDocument();
    expect(server.calls.some((call) => call.path === "/v1/intake")).toBe(false);
  });

  it("names what it could not place rather than guessing at it", async () => {
    mount(() => jsonOf(emptyStore()), "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile(A_RESUME);

    expect(await screen.findByText(/is not a year, month or day/)).toBeInTheDocument();
  });

  it("sends the decisions with the intake, and says what came in", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile(A_RESUME);
    await screen.findByText("Staff engineer");
    press("Bring these in");

    expect(await screen.findByText(/came in\./)).toBeInTheDocument();
    const sent = server.calls.find((call) => call.path === "/v1/intake");
    expect(sent).toBeDefined();
    const body = sent?.body as {
      intake: { records: unknown[] };
      decisions: { records: unknown[] };
    };
    expect(body.decisions.records).toHaveLength(body.intake.records.length);
  });

  it("leaves a record out when it is skipped", async () => {
    const server = storeServer(emptyStore());
    mount(server.answer, "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile(A_RESUME);
    await screen.findByText("Staff engineer");

    const row = screen.getByText("Staff engineer").closest("div")?.parentElement;
    fireEvent.click(within(row as HTMLElement).getByRole("radio", { name: "Skip" }));
    press("Bring these in");

    await screen.findByText(/came in\./);
    const sent = server.calls.find((call) => call.path === "/v1/intake");
    const body = sent?.body as { decisions: { records: { action: string }[] } };
    expect(body.decisions.records[0]?.action).toBe("skip");
  });

  // A whole-store backup restores every row exactly; reading it as a resume
  // would quietly turn history into a handful of records.
  it("sends someone with a backup file to the screen that restores one", async () => {
    mount(() => jsonOf(emptyStore()), "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile(JSON.stringify({ schemaVersion: 1, exportedAt: "2026-01-01T00:00:00.000Z" }));

    expect(await screen.findByText(/whole-store backup/)).toBeInTheDocument();
  });

  it("names the formats it reads when the file is none of them", async () => {
    mount(() => jsonOf(emptyStore()), "/import");

    await screen.findByLabelText("A resume to read");
    chooseFile("not a resume at all", "notes.txt");

    expect(
      await screen.findByText(/A PDF, a Word document, JSON Resume, Reactive Resume and RenderCV/),
    ).toBeInTheDocument();
  });
});

// A PDF is a print artifact: what a reader gets out of one is a guess, and a
// screen that does not say so invites it being approved unread.
describe("bringing in a file with no structure in it", () => {
  it("says a Word document was read from its layout, and shows what it found", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const paragraph = (text: string, extra = "") =>
      `<w:p>${extra}<w:r><w:t>${text}</w:t></w:r></w:p>`;
    const body = [
      paragraph("Ada Lovelace", '<w:pPr><w:pStyle w:val="Title"/></w:pPr>'),
      paragraph("ada@example.org"),
      paragraph("Experience", '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'),
      paragraph("Senior Engineer, Acme", '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'),
      paragraph("Cut runtime by 40%.", '<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>'),
    ].join("");
    const docx = zipSync({
      "word/document.xml": strToU8(
        `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
      ),
    });

    mount(() => jsonOf(emptyStore()), "/import");
    const input = await screen.findByLabelText("A resume to read");
    const file = new File([docx as BlobPart], "cv.docx");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    expect(await screen.findByText(/worked out from the layout/)).toBeInTheDocument();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
  });
});

describe("role profiles", () => {
  it("names a profile and adds a word to it in one motion", async () => {
    const store = aFilledStore();
    const server = storeServer(store);
    mount(server.answer, "/role-profiles?archived=false");

    await screen.findByRole("button", { name: "New role profile" });
    press("New role profile");
    type("New role profile", "Backend");
    press("Add");

    await waitFor(() => {
      expect(store.roleProfiles).toHaveLength(1);
    });

    type("Add a word to Backend", "Go");
    press("Add to Backend");

    // The word was not in the vocabulary, so it is created and added at once.
    await waitFor(() => {
      expect(store.roleProfileTags).toHaveLength(1);
    });
    expect(store.tags.map((tag) => tag.label)).toContain("Go");
  });

  it("says what each profile reaches before anything is applied", async () => {
    const store = aFilledStore();
    const backend = addTag(store, "Backend");
    const role = store.records[0];
    if (role === undefined) throw new Error("the fixture holds a record");
    store.recordTags.push({ tagId: backend.id, recordId: role.id });
    addRoleProfile(store, "Backend", [backend]);

    mount(storeServer(store).answer, "/role-profiles?archived=false");

    // The whole of a tagged record: its two points come with it.
    expect(await screen.findByText("1 record, 2 points")).toBeInTheDocument();
  });

  it("places what a profile selects on a resume, and says what it placed", async () => {
    const store = aFilledStore();
    const backend = addTag(store, "Backend");
    const engine = store.records.find((row) => row.title === "Difference Engine");
    const resume = store.resumes[0];
    if (engine === undefined || resume === undefined) throw new Error("the fixture holds both");
    store.recordTags.push({ tagId: backend.id, recordId: engine.id });
    const profile = addRoleProfile(store, "Backend", [backend]);

    const server = storeServer(store);
    mount(server.answer, `/resumes/${resume.id}?view=composition`);

    await screen.findByLabelText("Role profile to apply");
    type("Role profile to apply", profile.id);
    press("Apply");

    // The project section already holds that record, so the profile finds
    // nothing to add and says so rather than writing a second row.
    expect(await screen.findByText(/already on this resume/)).toBeInTheDocument();
    expect(store.resumeEntries.filter((row) => row.recordId === engine.id)).toHaveLength(1);
  });

  it("puts back what a resume had taken off rather than adding a second row", async () => {
    const store = aFilledStore();
    const backend = addTag(store, "Backend");
    const engine = store.records.find((row) => row.title === "Difference Engine");
    const resume = store.resumes[0];
    if (engine === undefined || resume === undefined) throw new Error("the fixture holds both");
    const placed = store.resumeEntries.findIndex((row) => row.recordId === engine.id);
    const entry = store.resumeEntries[placed];
    if (entry === undefined) throw new Error("the fixture places it");
    entry.isVisible = false;

    store.recordTags.push({ tagId: backend.id, recordId: engine.id });
    const profile = addRoleProfile(store, "Backend", [backend]);

    const server = storeServer(store);
    mount(server.answer, `/resumes/${resume.id}?view=composition`);

    await screen.findByLabelText("Role profile to apply");
    type("Role profile to apply", profile.id);
    press("Apply");

    // Re-read: the stub replaces the row rather than mutating the one held.
    await waitFor(() => {
      expect(store.resumeEntries[placed]?.isVisible).toBe(true);
    });
    expect(store.resumeEntries.filter((row) => row.recordId === engine.id)).toHaveLength(1);
  });
});
