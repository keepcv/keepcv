import { createClient } from "@keepcv/api";
import { BLANK_SPEC, visualSpecOf } from "@keepcv/templates";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildRouter } from "../app/router.js";
import { addResume, addTemplate, aFilledStore, emptyStore } from "../store.harness.js";
import { storeServer } from "../store-server.harness.js";

function mount(server: ReturnType<typeof storeServer>, path: string) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) =>
    Promise.resolve(server.answer(String(url), init)),
  );
  window.history.replaceState(null, "", path);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter({
    queries,
    api: createClient(window.location.origin, { sessionToken: "test" }),
    signOut: undefined,
  });
  const mounted = render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...mounted, router };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it("keeps fit and content while choosing a template, writes only on Apply, and resets fit explicitly", async () => {
  const store = aFilledStore();
  const resume = store.resumes[0];
  if (resume === undefined) throw new Error("Fixture has a resume");
  resume.templateId = "modern-v1";
  resume.templateConfig = { pageSize: "letter", margin: 24, fontSize: 12 };
  resume.pageLimit = 2;
  const other = addResume(store, { name: "Another resume", templateId: "classic-v1" });
  const selection = structuredClone(store.resumeEntryPoints);
  const server = storeServer(store);
  mount(server, `/resumes/${resume.id}?view=preview`);
  fireEvent.click(await screen.findByRole("button", { name: "Change template" }));
  fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
  expect(server.calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(store.resumes[0]?.templateId).toBe("modern-v1");
  fireEvent.click(screen.getByRole("button", { name: "Change template" }));
  fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply to this resume" }));
  await waitFor(() => expect(store.resumes[0]?.templateId).toBe("compact-v1"));
  expect(store.resumes[0]?.templateConfig).toEqual({
    pageSize: "letter",
    margin: 24,
    fontSize: 12,
  });
  expect(store.resumes[0]?.pageLimit).toBe(2);
  expect(store.resumeEntryPoints).toEqual(selection);
  expect(store.resumes.find((row) => row.id === other.id)?.templateId).toBe("classic-v1");
  fireEvent.click(screen.getByRole("button", { name: "Change template" }));
  fireEvent.click(screen.getByRole("radio", { name: "Classic" }));
  fireEvent.click(screen.getByLabelText("Use template defaults"));
  fireEvent.click(screen.getByRole("button", { name: "Apply to this resume" }));
  await waitFor(() => expect(store.resumes[0]?.templateConfig).toEqual({}));
  expect(store.resumes[0]?.pageLimit).toBe(2);
});

it("creates a template copy from a resume and returns to an unapplied candidate preview", async () => {
  const store = aFilledStore();
  const resume = store.resumes[0];
  if (resume === undefined) throw new Error("Fixture has a resume");
  resume.templateId = "modern-v1";
  const server = storeServer(store);
  const { router } = mount(server, `/resumes/${resume.id}?view=preview`);
  fireEvent.click(await screen.findByRole("button", { name: "Fit and checks" }));
  fireEvent.click(screen.getByRole("link", { name: "Make a copy and customize" }));
  fireEvent.change(await screen.findByLabelText("Template name"), {
    target: { value: "My modern copy" },
  });
  fireEvent.change(screen.getByLabelText("Accent"), { target: { value: "forest" } });
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));
  const chooser = await screen.findByRole("dialog", { name: "Choose a template" });
  expect(router.state.location.pathname).toBe(`/resumes/${resume.id}`);
  expect(within(chooser).getByRole("radio", { name: "My modern copy" })).toBeChecked();
  expect(store.resumes[0]?.templateId).toBe("modern-v1");
  expect(store.templates).toHaveLength(1);
  fireEvent.click(within(chooser).getByRole("button", { name: "Apply to this resume" }));
  await waitFor(() => expect(store.resumes[0]?.templateId).toBe(store.templates[0]?.id));
});

it("saves an edited copy as a new template while leaving the original and its resumes unchanged", async () => {
  const store = aFilledStore();
  const original = addTemplate(store, "Shared layout", { settings: { accent: "navy" } });
  const resume = store.resumes[0];
  if (resume === undefined) throw new Error("Fixture has a resume");
  resume.templateId = original.id;
  const server = storeServer(store);
  mount(server, `/templates/${original.id}`);
  fireEvent.change(await screen.findByLabelText("Accent"), { target: { value: "forest" } });
  fireEvent.click(screen.getByRole("button", { name: "Save as new template" }));
  fireEvent.change(screen.getByLabelText("New template name"), {
    target: { value: "Independent layout" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save copy" }));
  await screen.findByRole("heading", { name: "Independent layout" });
  expect(store.templates).toHaveLength(2);
  expect(
    visualSpecOf(store.templates.find((row) => row.id === original.id)?.spec ?? BLANK_SPEC)
      .settings["accent"],
  ).toBe("navy");
  expect(
    visualSpecOf(
      store.templates.find((row) => row.name === "Independent layout")?.spec ?? BLANK_SPEC,
    ).settings["accent"],
  ).toBe("forest");
  expect(store.resumes[0]?.templateId).toBe(original.id);
  expect(server.calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
});

it("recovers legacy template settings without publishing them until an explicit save", async () => {
  const store = emptyStore();
  const template = addTemplate(store, "Recovered layout");
  const spec = { settings: { accent: "forest" }, extraCss: ".kc-name { letter-spacing: 1px; }" };
  window.localStorage.setItem(`keepcv.template-edit:${template.id}`, JSON.stringify(spec));
  const server = storeServer(store);
  mount(server, `/templates/${template.id}`);
  expect(await screen.findByLabelText("Extra CSS")).toHaveValue(spec.extraCss);
  expect(screen.getByLabelText("Accent")).toHaveValue("forest");
  expect(server.calls.filter((call) => call.method !== "GET")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));
  await waitFor(() => expect(visualSpecOf(store.templates[0]?.spec ?? BLANK_SPEC)).toEqual(spec));
  expect(window.localStorage.getItem(`keepcv.template-edit:${template.id}`)).toBeNull();
});

it("keeps an unfinished new template when leaving and reopens it without creating a row", async () => {
  const store = emptyStore();
  const server = storeServer(store);
  const { router } = mount(server, "/templates/new");
  fireEvent.change(await screen.findByLabelText("Template name"), {
    target: { value: "Unfinished template" },
  });
  fireEvent.change(screen.getByLabelText("Extra CSS"), {
    target: { value: ".kc-name { letter-spacing: 2px; }" },
  });
  await act(async () => {
    void router.navigate({ to: "/templates", search: { archived: "exclude" } });
  });
  fireEvent.click(await screen.findByRole("button", { name: "Keep draft and leave" }));
  await screen.findByRole("link", { name: "Create template" });
  fireEvent.click(screen.getByRole("link", { name: "Create template" }));
  expect(await screen.findByLabelText("Template name")).toHaveValue("Unfinished template");
  expect(screen.getByLabelText("Extra CSS")).toHaveValue(".kc-name { letter-spacing: 2px; }");
  expect(store.templates).toHaveLength(0);
});

it("archives and restores an owned template while preserving its existing resume use", async () => {
  const store = aFilledStore();
  const template = addTemplate(store, "Reusable layout");
  const resume = store.resumes[0];
  if (resume === undefined) throw new Error("Fixture has a resume");
  resume.templateId = template.id;
  const server = storeServer(store);
  mount(server, "/templates?collection=mine");
  fireEvent.click(await screen.findByRole("button", { name: "Archive this template" }));
  await waitFor(() => expect(store.templates[0]?.archivedAt).not.toBeNull());
  fireEvent.click(screen.getByRole("link", { name: "Archived" }));
  fireEvent.click(await screen.findByRole("button", { name: "Restore this template" }));
  await waitFor(() => expect(store.templates[0]?.archivedAt).toBeNull());
  expect(store.resumes[0]?.templateId).toBe(template.id);
});
