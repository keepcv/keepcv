import { deriveRevision } from "@keepcv/core";
import type { RichText } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { buildRouter } from "../app/router.js";
import { apiClient } from "../lib/api.js";
import { addPoint, addTemplate, aFilledStore, emptyStore } from "../store.harness.js";
import { jsonOf, storeServer } from "../store-server.harness.js";
import { ChoiceRow } from "./import/ui/rows.js";

function mount(
  answer: (url: string, init?: RequestInit) => Response | Promise<Response>,
  path: string,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => Promise.resolve(answer(String(url), init))),
  );
  window.history.replaceState(null, "", path);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter({ queries, api: apiClient("a-token"), signOut: undefined });
  const mounted = render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...mounted, router, queries };
}

function downloads() {
  const blobs: Blob[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation((value: Blob | MediaSource) => {
    blobs.push(value as Blob);
    return "blob:test";
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  return blobs;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it("keeps repeated imported job titles in independent radio groups", () => {
  function Review() {
    const [choices, setChoices] = useState<("create" | "skip")[]>(["skip", "skip"]);
    return choices.map((choice, index) => (
      <ChoiceRow
        key={index}
        title="Software Engineer"
        choice={{ action: choice }}
        onChoose={(chosen) => {
          if (chosen.action === "merge") return;
          const action = chosen.action;
          setChoices((held) => held.map((old, at) => (at === index ? action : old)));
        }}
      />
    ));
  }
  render(<Review />);
  for (const group of screen.getAllByRole("group"))
    fireEvent.click(within(group).getByRole("radio", { name: "Add as new" }));
  const radios = screen.getAllByRole<HTMLInputElement>("radio", { name: "Add as new" });
  expect(radios.every((radio) => radio.checked)).toBe(true);
  fireEvent.click(screen.getAllByRole("radio", { name: "Skip" })[0] as HTMLElement);
  expect(radios[1]).toBeChecked();
});

it("flushes template edits before navigation and preserves failed edits for retry", async () => {
  const store = aFilledStore();
  const template = addTemplate(store, "Save audit");
  const server = storeServer(store);
  let refuse = true;
  const { router } = mount(
    (url, init) =>
      init?.method === "PATCH" && refuse
        ? jsonOf(
            {
              type: "about:blank",
              title: "Unavailable",
              status: 503,
              detail: "Try again",
              instance: new URL(url).pathname,
            },
            503,
          )
        : server.answer(url, init),
    `/templates/${template.id}`,
  );
  const css = ".kc-name { letter-spacing: 1px; }";
  fireEvent.change(await screen.findByLabelText("Extra CSS"), { target: { value: css } });
  await act(async () => {
    void router.navigate({ to: "/templates", search: { archived: "exclude" } });
  });
  expect(await screen.findByText("Unavailable")).toBeInTheDocument();
  expect(screen.getByLabelText("Extra CSS")).toHaveValue(css);
  expect(router.state.location.pathname).toBe(`/templates/${template.id}`);
  refuse = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry saving" }));
  await waitFor(() => {
    expect(store.templates.find((row) => row.id === template.id)?.spec.extraCss).toBe(css);
  });
  await act(async () => {
    await router.navigate({ to: "/templates", search: { archived: "exclude" } });
  });
  expect(router.state.location.pathname).toBe("/templates");
}, 15_000);

it("serializes settings changes against a slow save and sends the latest value", async () => {
  const store = aFilledStore();
  const template = addTemplate(store, "Slow audit");
  const server = storeServer(store);
  let release: (() => void) | undefined;
  let patches = 0;
  mount(async (url, init) => {
    if (init?.method === "PATCH") {
      const input = JSON.parse(String(init.body)) as { expectedUpdatedAt: string };
      expect(input.expectedUpdatedAt).toBe(
        store.templates.find((row) => row.id === template.id)?.updatedAt,
      );
      if (patches++ === 0)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    }
    return server.answer(url, init);
  }, `/templates/${template.id}`);
  fireEvent.change(await screen.findByLabelText("Extra CSS"), {
    target: { value: ".kc-name { letter-spacing: 1px; }" },
  });
  await waitFor(() => {
    expect(release).toBeDefined();
  });
  fireEvent.change(screen.getByLabelText("Extra CSS"), {
    target: { value: ".kc-name { letter-spacing: 2px; }" },
  });
  await act(async () => {
    release?.();
  });
  await waitFor(() => {
    expect(store.templates.find((row) => row.id === template.id)?.spec.extraCss).toContain("2px");
  });
  expect(server.calls.filter((call) => call.method === "PATCH")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Retry saving" })).not.toBeInTheDocument();
});

it("exports the visible pending settings and deduplicates repeated exports", async () => {
  const store = aFilledStore();
  const resume = store.resumes[0];
  if (resume === undefined) throw new Error("Fixture has a resume");
  const server = storeServer(store);
  const blobs = downloads();
  mount(server.answer, `/resumes/${resume.id}?view=preview`);
  fireEvent.change(await screen.findByLabelText("Body size"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Download HTML" }));
  expect(await blobs[0]?.text()).toContain("12pt");
  await screen.findByText("Export recorded in history");
  expect(server.versions[0]?.manifest.template.config["fontSize"]).toBe(12);
  fireEvent.click(screen.getByRole("button", { name: "Download HTML" }));
  await waitFor(() => {
    expect(
      server.calls.filter((call) => call.method === "POST" && call.path === "/v1/resume-versions"),
    ).toHaveLength(2);
  });
  expect(server.versions).toHaveLength(1);
});

it("still downloads when export history is unavailable", async () => {
  const store = aFilledStore();
  const server = storeServer(store);
  const blobs = downloads();
  mount(
    (url, init) =>
      init?.method === "POST" ? Promise.reject(new Error("Offline")) : server.answer(url, init),
    `/resumes/${store.resumes[0]?.id}?view=preview`,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Download HTML" }));
  expect(await blobs[0]?.text()).toContain("<!doctype html>");
  expect(await screen.findByText(/its version could not be saved/)).toBeInTheDocument();
  expect(server.versions).toHaveLength(0);
});

it("edits formatted wording with keyboard controls and can compare and reapply history", async () => {
  const store = emptyStore();
  const point = addPoint(store, "Led the project");
  const original = store.phrasingRevisions[0];
  if (original === undefined) throw new Error("Fixture has a revision");
  const body: RichText = [
    { t: "b", c: [{ t: "text", v: "Led" }] },
    { t: "text", v: " the " },
    { t: "a", href: "https://example.test", c: [{ t: "text", v: "project" }] },
  ];
  Object.assign(original, deriveRevision(body));
  const server = storeServer(store);
  mount(server.answer, `/points/${point.id}/edit`);
  const input = await screen.findByLabelText<HTMLTextAreaElement>("Wording, standard");
  expect(
    within(screen.getByRole("region", { name: "Formatted Wording, standard" })).getByRole("link"),
  ).toHaveAttribute("href", "https://example.test");
  input.setSelectionRange(4, 7);
  fireEvent.keyDown(input, { key: "i", ctrlKey: true });
  fireEvent.change(input, { target: { value: "Led the project successfully" } });
  fireEvent.blur(input);
  await waitFor(() => {
    expect(store.phrasingRevisions).toHaveLength(2);
  });
  const changed = store.phrasingRevisions[1]?.body;
  expect(JSON.stringify(changed)).toContain('"t":"i"');
  expect(JSON.stringify(changed)).toContain("https://example.test");
  expect(original.body).toEqual(body);
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  fireEvent.click(await screen.findByRole("button", { name: "Compare with current" }));
  expect(screen.getByRole("region", { name: "Wording comparison" })).toHaveTextContent(
    "Selected revision",
  );
  fireEvent.click(screen.getByRole("button", { name: "Use this wording" }));
  expect(input).toHaveValue("Led the project");
  fireEvent.blur(input);
  await waitFor(() => {
    const calls = server.calls.filter(
      (call) => call.method === "POST" && call.path.endsWith("/revisions"),
    );
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).toEqual({ body });
  });
  expect(original.body).toEqual(body);
});

it("offers unacknowledged formatted wording after reopening and saves it on retry", async () => {
  const store = emptyStore();
  const point = addPoint(store, "Keep these words");
  const server = storeServer(store);
  const first = mount(
    (url, init) =>
      init?.method === "PUT" ? Promise.reject(new Error("Offline")) : server.answer(url, init),
    `/points/${point.id}/edit`,
  );
  const input = await screen.findByLabelText<HTMLTextAreaElement>("Wording, standard");
  input.setSelectionRange(0, input.value.length);
  fireEvent.keyDown(input, { key: "b", metaKey: true });
  fireEvent.change(input, { target: { value: "Keep these words safely" } });
  expect(
    window.localStorage.getItem(`keepcv.phrasing-edit:${store.phrasings[0]?.id}`),
  ).not.toBeNull();
  fireEvent.blur(input);
  await screen.findByRole("button", { name: "Retry saving wording" });
  await act(async () => {
    first.unmount();
  });
  expect(
    window.localStorage.getItem(`keepcv.phrasing-edit:${store.phrasings[0]?.id}`),
  ).not.toBeNull();
  mount(server.answer, `/points/${point.id}/edit`);
  const reopened = await screen.findByLabelText("Wording, standard");
  expect(reopened).toHaveValue("Keep these words");
  fireEvent.click(screen.getByRole("button", { name: "Put it back" }));
  expect(reopened).toHaveValue("Keep these words safely");
  fireEvent.blur(reopened);
  await waitFor(() => {
    expect(store.phrasingRevisions).toHaveLength(2);
  });
  expect(store.phrasingRevisions[1]?.body).toEqual([
    { t: "b", c: [{ t: "text", v: "Keep these words safely" }] },
  ]);
  expect(window.localStorage.getItem(`keepcv.phrasing-edit:${store.phrasings[0]?.id}`)).toBeNull();
});

it("recovers a failed settings save after reopening the template", async () => {
  const store = aFilledStore();
  const template = addTemplate(store, "Recover audit");
  const server = storeServer(store);
  const first = mount(
    (url, init) =>
      init?.method === "PATCH" ? Promise.reject(new Error("Offline")) : server.answer(url, init),
    `/templates/${template.id}`,
  );
  const css = ".kc-name { letter-spacing: 3px; }";
  fireEvent.change(await screen.findByLabelText("Extra CSS"), { target: { value: css } });
  await screen.findByRole("button", { name: "Retry saving" });
  await act(async () => {
    first.unmount();
  });
  await waitFor(() => {
    expect(first.queries.isMutating()).toBe(0);
  });
  expect(window.localStorage.getItem(`keepcv.template-edit:${template.id}`)).not.toBeNull();
  mount(server.answer, `/templates/${template.id}`);
  expect(await screen.findByLabelText("Extra CSS")).toHaveValue(css);
  await waitFor(() => {
    expect(store.templates.find((row) => row.id === template.id)?.spec.extraCss).toBe(css);
  });
  expect(window.localStorage.getItem(`keepcv.template-edit:${template.id}`)).toBeNull();
});
