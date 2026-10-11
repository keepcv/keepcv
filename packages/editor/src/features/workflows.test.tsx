import { createClient } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { phrasingSetSchema } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { type DataPagePresentation, Editor } from "../index.js";
import {
  addEntry,
  addEntryPoint,
  addOrganisation,
  addPhrasing,
  addPoint,
  addRecord,
  addResume,
  addSection,
  addTemplate,
  aFilledStore,
  emptyStore,
} from "../store.harness.js";
import { jsonOf, storeServer } from "../store-server.harness.js";

function mount(store: Store, path: string, dataPage?: DataPagePresentation, refuse = false) {
  const server = storeServer(store);
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    Promise.resolve(
      refuse && init?.method === "POST"
        ? jsonOf(
            {
              type: "https://keepcv.app/problems/unavailable",
              title: "Unavailable",
              status: 503,
              detail: "Try again.",
              instance: "/v1/resumes",
            },
            503,
          )
        : server.answer(String(url), init),
    ),
  );
  window.history.replaceState(null, "", path);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <Editor api={createClient(window.location.origin)} queries={queries} dataPage={dataPage} />,
  );
  return server;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it.each([emptyStore, aFilledStore])(
  "offers import on the overview with or without career content",
  async (makeStore) => {
    mount(makeStore(), "/");
    const main = await screen.findByRole("main");
    expect(await within(main).findByRole("link", { name: "Import resume" })).toHaveAttribute(
      "href",
      "/import",
    );
  },
);

it("keeps optional point details collapsed and preserves an in-progress metric while toggling", async () => {
  const store = emptyStore();
  const point = addPoint(store, "Reduced response time");
  mount(store, `/points/${point.id}/edit`);
  const summary = await screen.findByText("Metrics", { selector: "h2" });
  const details = summary.closest("details");
  if (details === null) throw new Error("Metrics must be expandable");
  expect(details).not.toHaveAttribute("open");
  const control = summary.closest("summary");
  if (control === null) throw new Error("Metrics must have a summary control");
  fireEvent.click(control);
  expect(details).toHaveAttribute("open");
  fireEvent.click(within(details).getByRole("button", { name: "Add a metric" }));
  const label = within(details).getByLabelText("Label");
  fireEvent.change(label, { target: { value: "Time saved" } });
  fireEvent.click(control);
  expect(label).not.toBeVisible();
  fireEvent.click(control);
  expect(label).toHaveValue("Time saved");
  expect(label).toBeVisible();
  expect(store.metrics).toHaveLength(0);
});

it("opens resume creation from a template with that template selected", async () => {
  const store = emptyStore();
  const template = addTemplate(store, "Quiet headings");
  const server = mount(store, "/templates");
  const title = await screen.findByRole("link", { name: template.name });
  const row = title.closest("li");
  if (row === null) throw new Error("Template must have a row");
  fireEvent.click(within(row).getByRole("link", { name: "Use template" }));
  expect(await screen.findByLabelText("Template")).toHaveValue(template.id);
  fireEvent.change(screen.getByLabelText("Resume name"), {
    target: { value: "Backend" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create resume" }));
  expect(await screen.findByRole("heading", { name: "Backend" })).toBeInTheDocument();
  expect(store.resumes[0]?.templateId).toBe(template.id);
  expect(
    server.calls.filter((call) => call.path === "/v1/resumes" && call.method === "POST"),
  ).toHaveLength(1);
});

it("retains the resume form and template choice when creation is refused", async () => {
  const store = emptyStore();
  const template = addTemplate(store, "Quiet headings");
  mount(store, `/resumes?create=true&template=${template.id}`, undefined, true);
  fireEvent.change(await screen.findByLabelText("Resume name"), {
    target: { value: "Backend" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create resume" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
  expect(screen.getByLabelText("Resume name")).toHaveValue("Backend");
  expect(screen.getByLabelText("Template")).toHaveValue(template.id);
  expect(window.location.pathname).toBe("/resumes");
  await waitFor(() => expect(store.resumes).toHaveLength(0));
});

it("retains a design form when creation is refused", async () => {
  const store = emptyStore();
  mount(store, "/templates", undefined, true);
  fireEvent.click(await screen.findByRole("button", { name: "New design" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Quiet headings" } });
  fireEvent.click(screen.getByRole("button", { name: "Create design" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
  expect(screen.getByLabelText("Name")).toHaveValue("Quiet headings");
  expect(window.location.pathname).toBe("/templates");
  expect(store.templates).toHaveLength(0);
});

it("composes data-page guidance without rendering launcher instructions", async () => {
  const presentation: DataPagePresentation = {
    storageDescription: "Saved by the connected application.",
    backupDescription: "Keep your own copy.",
    restoreDescription: "Choose an empty store to restore into.",
    showTerminalInstructions: false,
  };
  mount(aFilledStore(), "/data", presentation);
  expect(await screen.findByText(presentation.storageDescription)).toBeInTheDocument();
  const main = screen.getByRole("main");
  expect(main).toHaveTextContent(presentation.backupDescription);
  expect(main).toHaveTextContent(presentation.restoreDescription);
  expect(main).not.toHaveTextContent(/launcher|machine|disk|--data-dir|From a terminal/);
  expect(main.querySelector("pre")).toBeNull();
  expect(within(main).getByRole("button", { name: "Download a backup" })).toBeEnabled();
  expect(within(main).getByLabelText("A backup file to load")).toBeEnabled();
});

it("retries attaching a record summary without creating another wording set, then saves revisions", async () => {
  const store = emptyStore();
  const record = addRecord(store, { title: "Search service" });
  const server = mount(store, `/records/${record.id}`);
  await screen.findByRole("heading", { name: record.title ?? "" });
  let refused = false;
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH" && String(url).endsWith(`/records/${record.id}`) && !refused) {
      refused = true;
      return Promise.resolve(
        jsonOf({ title: "Unavailable", status: 503, detail: "Try again." }, 503),
      );
    }
    return Promise.resolve(server.answer(String(url), init));
  });
  fireEvent.click(screen.getByRole("button", { name: "Write a summary" }));
  fireEvent.click(await screen.findByRole("button", { name: "Retry summary" }));
  await waitFor(() => expect(store.records[0]?.summarySetId).not.toBeNull());
  expect(store.phrasingSets).toHaveLength(1);
  const input = await screen.findByLabelText("Wording, standard");
  fireEvent.change(input, { target: { value: "Built a search service for 40 teams." } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(store.phrasingRevisions.at(-1)?.plainText).toBe("Built a search service for 40 teams.");
  });
  expect(store.phrasingSets).toHaveLength(1);
  expect(store.phrasingSets[0]?.purpose).toBe("record_summary");
  expect(store.records[0]?.summarySetId).toBe(store.phrasingSets[0]?.id);
  expect(store.records[0]?.title).toBe("Search service");
  expect(store.phrasingRevisions).toHaveLength(2);
  expect(
    server.calls.filter((call) => call.path === "/v1/phrasing-sets" && call.method === "POST"),
  ).toHaveLength(1);
});

it("expands alternate wordings on demand and retains typed text across collapse", async () => {
  const store = emptyStore();
  const point = addPoint(store, "Led the search service project");
  addPhrasing(store, point.phrasingSetId, "Led search", { variant: "short", sortKey: "a1" });
  mount(store, `/points/${point.id}/edit`);
  const input = await screen.findByLabelText("Wording, short");
  expect(input).not.toBeVisible();
  const details = input.closest("details.group\\/wording");
  if (details === null) throw new Error("Alternate wording must be expandable");
  const summary = details.querySelector("summary");
  if (summary === null) throw new Error("Wording must have an expansion control");
  fireEvent.click(summary);
  expect(input).toBeVisible();
  fireEvent.change(input, { target: { value: "Led search for 40 teams" } });
  fireEvent.click(summary);
  expect(input).not.toBeVisible();
  fireEvent.click(summary);
  expect(input).toHaveValue("Led search for 40 teams");
  fireEvent.blur(input);
  await waitFor(() =>
    expect(store.phrasingRevisions.at(-1)?.plainText).toBe("Led search for 40 teams"),
  );
});

it("keeps resume records compact while allowing wording changes and reversible removal", async () => {
  const store = aFilledStore();
  const section = store.resumeSections[0];
  if (section === undefined) throw new Error("Fixture has a section");
  const record = addRecord(store, { kind: "experience", title: "Search engineer", sortKey: "a1" });
  const point = addPoint(store, "Built search for 40 teams", { recordId: record.id });
  const alternative = addPhrasing(store, point.phrasingSetId, "Built search", {
    variant: "short",
    sortKey: "a1",
  });
  const entry = addEntry(store, section, record.id, { sortKey: "a1" });
  addEntryPoint(store, entry, point);
  mount(store, `/resumes/${section.resumeId}`);
  const link = await screen.findByRole("link", { name: "Search engineer" });
  const row = link.closest("li");
  if (row === null) throw new Error("Record must have a row");
  const details = row.querySelector("details");
  if (details === null) throw new Error("Resume record points must be expandable");
  expect(details).not.toHaveAttribute("open");
  const summary = details.querySelector("summary");
  if (summary === null) throw new Error("Record must have an expansion control");
  fireEvent.click(summary);
  const choose = within(row).getByLabelText("Wording for Built search for 40 teams");
  expect(choose).not.toBeVisible();
  fireEvent.click(within(row).getByText("Change wording"));
  expect(choose).toBeVisible();
  fireEvent.change(choose, { target: { value: alternative.id } });
  await waitFor(() => expect(store.resumeEntryPoints.at(-1)?.phrasingId).toBe(alternative.id));
  fireEvent.click(
    within(row).getByRole("button", { name: "Remove Search engineer from this resume" }),
  );
  await waitFor(() =>
    expect(store.resumeEntries.find((item) => item.id === entry.id)?.archivedAt).not.toBeNull(),
  );
  expect(store.records.find((item) => item.id === record.id)?.archivedAt).toBeNull();
  expect(store.points.find((item) => item.id === point.id)?.archivedAt).toBeNull();
});

it("identifies repeated job titles in the picker and returns to the parent when cancelled", async () => {
  const store = emptyStore();
  const cedar = addRecord(store, {
    title: "Engineer",
    organisationId: addOrganisation(store, "Cedar"),
  });
  const birch = addRecord(store, {
    title: "Engineer",
    organisationId: addOrganisation(store, "Birch"),
  });
  mount(store, `/points/new?recordId=${cedar.id}`);
  const picker = await screen.findByLabelText("Record");
  expect(within(picker).getByRole("option", { name: /Engineer - Cedar/ })).toHaveValue(cedar.id);
  expect(within(picker).getByRole("option", { name: /Engineer - Birch/ })).toHaveValue(birch.id);
  fireEvent.click(screen.getByRole("link", { name: "Cancel" }));
  expect(await screen.findByRole("heading", { name: "Engineer" })).toBeInTheDocument();
  expect(window.location.pathname).toBe(`/records/${cedar.id}`);
  expect(store.points).toHaveLength(0);
});

it("opens an existing record summary for editing and shows the resumes its default affects", async () => {
  const store = emptyStore();
  const record = addRecord(store, { title: "Search service" });
  const set = phrasingSetSchema.parse({
    id: newUuid(),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: null,
    purpose: "record_summary",
    canonicalPhrasingId: null,
  });
  store.phrasingSets.push(set);
  const wording = addPhrasing(store, set.id, "Built search for product teams.");
  set.canonicalPhrasingId = wording.id;
  record.summarySetId = set.id;
  const resume = addResume(store, { name: "Backend application" });
  addEntry(store, addSection(store, resume.id, { kind: "project" }), record.id);
  mount(store, `/records/${record.id}`);
  const input = await screen.findByLabelText("Wording, standard");
  expect(input).not.toBeVisible();
  const details = input.closest("details.group\\/wording");
  const summary = details?.querySelector("summary");
  if (summary == null) throw new Error("Summary wording must be expandable");
  expect(summary).toHaveTextContent("Built search for product teams.");
  fireEvent.click(summary);
  expect(input).toBeVisible();
  expect(screen.getByText("Used in 1 resume")).toBeVisible();
  expect(screen.getByText(/Resumes use the default summary/)).toBeVisible();
  fireEvent.change(input, { target: { value: "Built search for 40 product teams." } });
  fireEvent.blur(input);
  await waitFor(() =>
    expect(store.phrasingRevisions.at(-1)?.plainText).toBe("Built search for 40 product teams."),
  );
  expect(store.phrasingRevisions[0]?.plainText).toBe("Built search for product teams.");
  expect(store.phrasings[0]?.id).toBe(wording.id);
});

it("retains a new wording's name and type when creation is refused", async () => {
  const store = emptyStore();
  const point = addPoint(store, "Built search for product teams");
  mount(store, `/points/${point.id}/edit`, undefined, true);
  fireEvent.click(await screen.findByRole("button", { name: "Add a wording" }));
  fireEvent.change(screen.getByLabelText("New wording type"), { target: { value: "angled" } });
  fireEvent.change(screen.getByLabelText("Wording name (optional)"), {
    target: { value: "Leadership" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create wording" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again.");
  expect(screen.getByLabelText("New wording type")).toHaveValue("angled");
  expect(screen.getByLabelText("Wording name (optional)")).toHaveValue("Leadership");
  expect(store.phrasings).toHaveLength(1);
});
