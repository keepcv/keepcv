import { createClient } from "@keepcv/api";
import { captureManifest, compile } from "@keepcv/core";
import type { Resume, Timestamp } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Editor } from "../index.js";
import { addPoint, aFilledStore } from "../store.harness.js";
import { jsonOf, storeServer } from "../store-server.harness.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function open(path: string, namespace?: string) {
  window.history.replaceState(null, "", path);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const mounted = render(
    <Editor
      api={createClient(window.location.origin, { sessionToken: "test" })}
      queries={queries}
      recoveryNamespace={namespace}
      signOut={() => mounted.unmount()}
    />,
  );
  return { ...mounted, queries };
}

async function leave(queries: QueryClient) {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
  await waitFor(() => expect(queries.isMutating()).toBe(0));
  queries.clear();
}

const fields = {
  Company: "Pending company",
  Role: "Pending role",
  Posting: "https://example.test/pending",
  "Applied on": "2026-10-13",
  "Job description": "Pending posting words",
};

it("keeps already-stored recovery for explicit Revert without another write", async () => {
  const store = aFilledStore();
  const resume = store.resumes[0] as Resume;
  const key = `keepcv.target-edit:${resume.id}`;
  window.localStorage.setItem(
    key,
    JSON.stringify({
      values: {
        company: resume.targetCompany ?? "",
        role: resume.targetRole ?? "",
        url: resume.targetUrl ?? "",
        appliedOn: resume.appliedOn ?? "",
        jdText: resume.targetJdText ?? "",
      },
      expectedUpdatedAt: resume.updatedAt,
    }),
  );
  const server = storeServer(store);
  vi.stubGlobal("fetch", server.answer);
  const mounted = open(`/resumes/${resume.id}?view=target`);
  await screen.findByLabelText("Company");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(window.localStorage.getItem(key)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revert" }));
  expect(window.localStorage.getItem(key)).toBeNull();
  expect(server.calls.every((call) => call.method === "GET")).toBe(true);
  await leave(mounted.queries);
});

it.each(["validation", 400, 409, 429, 500, "offline"] as const)(
  "retains every target field after %s, navigation and caller sign-out",
  async (refusal) => {
    const store = aFilledStore();
    const resume = store.resumes[0] as Resume;
    const committed = structuredClone(store);
    const server = storeServer(store);
    let attempts = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (init?.method !== "PATCH") return server.answer(url, init);
      attempts++;
      if (refusal === "offline") throw new TypeError("Failed to fetch");
      if (refusal === 409) {
        resume.targetCompany = "Changed elsewhere";
        resume.updatedAt = "2026-10-13T00:00:00.000Z" as Timestamp;
      }
      return jsonOf(
        {
          type: "about:blank",
          title: "Refused",
          status: refusal,
          detail: "Synthetic refusal",
          instance: new URL(url).pathname,
          ...(refusal === 409 ? { current: resume } : {}),
        },
        typeof refusal === "number" ? refusal : 400,
      );
    });
    const path = `/resumes/${resume.id}?view=target`;
    const mounted = open(path, "store");
    await screen.findByLabelText("Company");
    const values = {
      ...fields,
      ...(refusal === "validation" ? { "Applied on": "unfinished date" } : {}),
    };
    for (const [label, value] of Object.entries(values))
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mounted.queries.isMutating()).toBe(0));
    if (refusal !== "validation")
      await screen.findByText(
        refusal === 409
          ? "This resume changed while you were editing it"
          : refusal === "offline"
            ? "Failed to fetch"
            : "Refused",
      );
    expect(attempts).toBe(refusal === "validation" ? 0 : 1);
    fireEvent.click(screen.getByRole("link", { name: "Content" }));
    await waitFor(() => expect(screen.queryByLabelText("Company")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("link", { name: "Job target" }));
    for (const [label, value] of Object.entries(values))
      expect(await screen.findByLabelText(label)).toHaveValue(value);
    await leave(mounted.queries);
    const reopened = open(path, "store");
    for (const [label, value] of Object.entries(values))
      expect(await screen.findByLabelText(label)).toHaveValue(value);
    expect(store.phrasingRevisions).toEqual(committed.phrasingRevisions);
    expect(server.versions).toEqual([]);
    const backup = await (await server.answer(`${window.location.origin}/v1/export`)).text();
    for (const value of Object.values(values)) expect(backup).not.toContain(JSON.stringify(value));
    const options = { generatedAt: "2026-10-13T00:00:00.000Z" };
    expect(compile(store, resume.id, options)).toEqual(compile(committed, resume.id, options));
    expect(captureManifest(store, resume.id)?.resume.targetCompany).not.toBe(fields.Company);
    expect(attempts).toBe(refusal === "validation" ? 0 : 1);
    await leave(reopened.queries);
  },
);

it("keeps the recovered conflict token until an explicit resolution and clears only acknowledged input", async () => {
  const store = aFilledStore();
  const resume = store.resumes[0] as Resume;
  const originalToken = resume.updatedAt;
  const server = storeServer(store);
  let release: (() => void) | undefined;
  const tokens: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as { expectedUpdatedAt: string };
      tokens.push(body.expectedUpdatedAt);
      if (body.expectedUpdatedAt !== store.resumes[0]?.updatedAt)
        return jsonOf(
          {
            type: "about:blank",
            title: "Conflict",
            status: 409,
            detail: "Synthetic conflict",
            instance: new URL(url).pathname,
            current: resume,
          },
          409,
        );
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return server.answer(url, init);
  });
  const path = `/resumes/${resume.id}?view=target`;
  const first = open(path);
  fireEvent.change(await screen.findByLabelText("Company"), { target: { value: "First edit" } });
  await leave(first.queries);
  resume.targetCompany = "Other writer";
  resume.updatedAt = "2026-10-13T00:00:00.000Z" as Timestamp;
  const reopened = open(path);
  expect(await screen.findByLabelText("Company")).toHaveValue("First edit");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Save mine over it" });
  expect(tokens).toEqual([originalToken]);
  fireEvent.click(screen.getByRole("button", { name: "Save mine over it" }));
  fireEvent.click(screen.getByRole("button", { name: "Saving" }));
  await waitFor(() => expect(release).toBeDefined());
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Newer edit" } });
  await act(async () => release?.());
  await waitFor(() => expect(store.resumes[0]?.targetCompany).toBe("First edit"));
  expect(screen.getByLabelText("Company")).toHaveValue("Newer edit");
  expect(tokens).toHaveLength(2);
  expect(window.localStorage.getItem(`keepcv.target-edit:${resume.id}`)).toContain("Newer edit");
  await leave(reopened.queries);
  const last = open(path);
  expect(await screen.findByLabelText("Company")).toHaveValue("Newer edit");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(tokens).toHaveLength(3));
  expect(tokens[2]).toBe(store.resumes[0]?.updatedAt);
  await act(async () => release?.());
  await waitFor(() =>
    expect(window.localStorage.getItem(`keepcv.target-edit:${resume.id}`)).toBeNull(),
  );
  fireEvent.change(screen.getByLabelText("Company"), { target: { value: "Discard me" } });
  fireEvent.click(screen.getByRole("button", { name: "Revert" }));
  expect(window.localStorage.getItem(`keepcv.target-edit:${resume.id}`)).toBeNull();
  await leave(last.queries);
});

it.each([
  { kind: "profile", path: () => "/profile", heading: "Profile", label: "Name", button: "Save" },
  {
    kind: "record",
    path: (record: string) => `/records/${record}/edit`,
    heading: "Edit record",
    label: "Title",
    button: "Save",
  },
  {
    kind: "new record",
    path: () => "/records/new?kind=experience",
    heading: "New record",
    label: "Title",
    button: "Add record",
  },
  {
    kind: "point",
    path: () => "/points/new",
    heading: "New point",
    label: "Point",
    button: "Add point",
  },
  {
    kind: "evidence",
    path: (_record: string, point: string) => `/points/${point}/edit`,
    heading: "Point",
    label: "Link",
    button: "Add evidence",
    reveal: () => {
      fireEvent.click(screen.getByText("Private evidence"));
      fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));
    },
  },
  {
    kind: "placement",
    path: (_record: string, point: string) => `/points/${point}/edit`,
    heading: "Point",
    label: "Date (optional)",
    value: "2026-10-13",
    button: "Save",
    reveal: () => fireEvent.click(screen.getByText("Record and confidence")),
  },
  {
    kind: "metric",
    path: (_record: string, point: string) => `/points/${point}/edit`,
    heading: "Point",
    label: "Label",
    button: "Add metric",
    reveal: () => {
      fireEvent.click(screen.getByText("Metrics"));
      fireEvent.click(screen.getByRole("button", { name: "Add a metric" }));
      fireEvent.change(screen.getByLabelText("Value"), { target: { value: "12" } });
    },
  },
  {
    kind: "record link",
    path: (record: string) => `/records/${record}`,
    heading: "Engine lead",
    label: "Address",
    value: "https://example.test/pending",
    button: "Add link",
    reveal: () => {
      fireEvent.click(screen.getByText("Links", { exact: true }));
      fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
    },
  },
  {
    kind: "record field",
    path: (record: string) => `/records/${record}`,
    heading: "Engine lead",
    label: "Name",
    button: "Add field",
    reveal: () => {
      fireEvent.click(screen.getByText("Extra fields", { exact: true }));
      fireEvent.click(screen.getByRole("button", { name: "Add a field" }));
      fireEvent.change(screen.getByLabelText("Value"), { target: { value: "12" } });
    },
  },
  {
    kind: "contact",
    path: () => "/profile",
    heading: "Profile",
    label: "Value",
    button: "Save",
    reveal: () =>
      fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0] as HTMLElement),
  },
  {
    kind: "new contact",
    path: () => "/profile",
    heading: "Profile",
    label: "Value",
    button: "Add contact",
    reveal: () => fireEvent.click(screen.getByRole("button", { name: "Add contact" })),
  },
])(
  "retains refused $kind input through sign-out and reopening",
  async ({ path: pathOf, heading, label, button, reveal, value = "Pending input" }) => {
    const store = aFilledStore();
    const point = addPoint(store, "Existing words");
    const server = storeServer(store);
    let refuse = true;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (refuse && init?.method !== undefined && init.method !== "GET")
        throw new TypeError("Offline");
      return server.answer(url, init);
    });
    const path = pathOf(store.records[0]?.id ?? "", point.id);
    const first = open(path);
    await screen.findByRole("heading", { name: heading });
    reveal?.();
    fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    fireEvent.click(screen.getAllByRole("button", { name: button }).at(-1) as HTMLElement);
    await screen.findByText("Offline");
    expect(screen.getByLabelText(label)).toHaveValue(value);
    await leave(first.queries);
    const reopened = open(path);
    expect(await screen.findByLabelText(label)).toHaveValue(value);
    refuse = false;
    fireEvent.click(screen.getAllByRole("button", { name: button }).at(-1) as HTMLElement);
    await waitFor(() => expect(window.localStorage.length).toBe(0));
    await leave(reopened.queries);
  },
);
