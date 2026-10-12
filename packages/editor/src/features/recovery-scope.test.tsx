import { createClient } from "@keepcv/api";
import { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Editor } from "../index.js";
import { addPoint, addTemplate, aFilledStore } from "../store.harness.js";
import { storeServer } from "../store-server.harness.js";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it.each([
  {
    kind: "wording",
    label: "Wording, standard",
    original: "Original wording",
    values: ["First pending words", "Second pending words"],
  },
  {
    kind: "template",
    label: "Extra CSS",
    original: "",
    values: [".kc-name { color: red; }", ".kc-name { color: blue; }"],
  },
  { kind: "resume", label: "Body size", original: "10.5", values: ["12", "11"] },
  {
    kind: "target",
    label: "Company",
    original: "Babbage Ltd",
    values: ["First pending company", "Second pending company"],
  },
])(
  "keeps failed $kind edits with their store through sign-out and return",
  async ({ kind, label, original, values }) => {
    const firstStore = aFilledStore();
    const point = addPoint(firstStore, "Original wording");
    const template = addTemplate(firstStore, "Recovery design");
    const resume = firstStore.resumes[0];
    if (resume === undefined) throw new Error("Fixture has a resume");
    const secondStore = structuredClone(firstStore);
    const servers = [storeServer(firstStore), storeServer(secondStore)];
    const path =
      kind === "wording"
        ? `/points/${point.id}/edit`
        : kind === "template"
          ? `/templates/${template.id}`
          : `/resumes/${resume.id}?view=${kind === "target" ? "target" : "preview"}`;
    let refuse = true;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      const request = new Request(url, init);
      const index = request.headers.get("x-keepcv-session") === "first" ? 0 : 1;
      if (refuse && request.method !== "GET") return Promise.reject(new Error("Offline"));
      return Promise.resolve(servers[index]?.answer(url, init));
    });

    async function open(namespace: string | undefined, token: string) {
      window.history.replaceState(null, "", path);
      const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
      const mounted = render(
        <Editor
          api={createClient(window.location.origin, { sessionToken: token })}
          queries={queries}
          recoveryNamespace={namespace}
          signOut={() => mounted.unmount()}
        />,
      );
      const input = await screen.findByLabelText(label);
      return { queries, input, ...mounted };
    }
    async function leave(queries: QueryClient) {
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
      await waitFor(() => expect(queries.isMutating()).toBe(0));
      queries.clear();
    }
    async function edit(value: string | undefined) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
      if (kind === "wording") fireEvent.blur(screen.getByLabelText(label));
      if (kind === "target") {
        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        await screen.findByText("Offline");
      } else
        await screen.findByRole("button", {
          name: kind === "wording" ? "Retry saving wording" : "Retry saving",
        });
    }

    const legacy = await open(undefined, "first");
    await edit(values[0]);
    await leave(legacy.queries);
    const legacyEntries = Object.entries(window.localStorage);
    const first = await open("first:store", "first");
    expect(first.input).toHaveValue(original);
    expect(screen.queryByRole("button", { name: "Restore draft" })).not.toBeInTheDocument();
    await edit(values[0]);
    await leave(first.queries);
    const second = await open("second:store", "second");
    expect(second.input).toHaveValue(original);
    expect(screen.queryByRole("button", { name: "Restore draft" })).not.toBeInTheDocument();
    await edit(values[1]);
    await leave(second.queries);
    expect(window.localStorage.length).toBe(3);

    for (const [index, namespace, token] of [
      [0, "first:store", "first"],
      [1, "second:store", "second"],
    ] as const) {
      const reopened = await open(namespace, token);
      if (kind === "wording") {
        expect(reopened.input).toHaveValue(original);
        fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
      }
      expect(reopened.input).toHaveValue(values[index]);
      if (kind === "wording") {
        refuse = false;
        fireEvent.blur(reopened.input);
      } else {
        const retry = await screen.findByRole("button", {
          name: kind === "target" ? "Save" : "Retry saving",
        });
        refuse = false;
        fireEvent.click(retry);
      }
      await waitFor(() => expect(window.localStorage.length).toBe(2 - index));
      await leave(reopened.queries);
      refuse = true;
    }
    expect(Object.entries(window.localStorage)).toEqual(legacyEntries);
    const legacyReturn = await open(undefined, "first");
    if (kind === "wording")
      expect(screen.getByRole("button", { name: "Restore draft" })).toBeInTheDocument();
    else expect(legacyReturn.input).toHaveValue(values[0]);
    await leave(legacyReturn.queries);
  },
  20_000,
);
