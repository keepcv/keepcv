import { createClient } from "@keepcv/api";
import { isTemplateDefinition } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildRouter } from "../app/router.js";
import { addTemplate, emptyStore } from "../store.harness.js";
import { storeServer } from "../store-server.harness.js";

vi.mock("./templates/ui/source-editor.js", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Template source"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

function mount(store: ReturnType<typeof emptyStore>, path: string) {
  const server = storeServer(store);
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
  return {
    ...render(
      <QueryClientProvider client={queries}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    server,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it("creates an owned HTML copy with editable source, data discovery and explicit save", async () => {
  const store = emptyStore();
  const { server } = mount(store, "/templates/new?basedOn=studio-html-v1");
  const source = await screen.findByLabelText<HTMLTextAreaElement>("Template source");
  expect(source.value).toContain("resume.header.fullName");
  fireEvent.change(screen.getByLabelText("Template name"), {
    target: { value: "My creative layout" },
  });
  fireEvent.change(source, {
    target: { value: "<main><h1>{{ resume.header.fullName | default: 'Name' }}</h1></main>" },
  });
  expect(server.calls.filter((call) => call.method === "POST")).toHaveLength(0);
  fireEvent.click(screen.getByText("Page defaults"));
  fireEvent.change(screen.getByLabelText("Page size"), { target: { value: "letter" } });
  fireEvent.click(screen.getByRole("button", { name: "Resume data" }));
  fireEvent.change(screen.getByLabelText("Find a template field"), { target: { value: "points" } });
  expect(screen.getByText("resume.sections[0].entries[0].points")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save template" }));
  await waitFor(() => expect(store.templates).toHaveLength(1));
  const spec = store.templates[0]?.spec;
  expect(isTemplateDefinition(spec)).toBe(true);
  if (!isTemplateDefinition(spec)) throw new Error("Expected a typed definition");
  expect(spec.type).toBe("html");
  expect(spec.payload["page"]).toMatchObject({ size: "letter", marginMm: 14 });
  expect(JSON.stringify(spec)).toContain("default: 'Name'");
});

it("keeps invalid source recoverable, blocks saving and supports file undo", async () => {
  const store = emptyStore();
  const mounted = mount(store, "/templates/new?basedOn=folio-html-v1");
  fireEvent.change(await screen.findByLabelText("Template source"), {
    target: { value: "<script>bad</script>" },
  });
  expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Download template file" })).toBeEnabled();
  expect(screen.getByRole("alert")).toHaveTextContent("script");
  mounted.unmount();
  mount(store, "/templates/new?basedOn=folio-html-v1");
  expect(await screen.findByLabelText("Template source")).toHaveValue("<script>bad</script>");
  fireEvent.click(screen.getByText("Manage files"));
  fireEvent.change(screen.getByLabelText("New file path"), {
    target: { value: "partials/new.html" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add source file" }));
  expect(screen.getByLabelText("Bundle file")).toHaveValue("partials/new.html");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.queryByRole("option", { name: "partials/new.html" })).not.toBeInTheDocument();
});

it("retains unsupported template definitions in a usable library and offers source recovery", async () => {
  const store = emptyStore();
  const row = addTemplate(store, "Future layout");
  row.spec = { type: "latex", version: 8, payload: { files: { "main.tex": "SOURCE" } } };
  mount(store, `/templates/${row.id}`);
  expect(await screen.findByLabelText("Template name")).toHaveValue("Future layout");
  expect(screen.getByText(/This template type is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download template file" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
  expect(row.spec.payload["files"]).toEqual({ "main.tex": "SOURCE" });
});
