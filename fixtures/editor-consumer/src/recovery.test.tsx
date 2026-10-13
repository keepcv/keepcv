import "@testing-library/jest-dom/vitest";
import { createApi, createClient, sessionTokenAuth } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { Editor } from "@keepcv/editor";
import { pointInputSchema, resumeInputSchema, type Store } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it.each([
  {
    kind: "wording",
    label: "Wording, standard",
    original: "Original wording",
    values: ["First pending words", "Second pending words"],
    savedValue: (store: Store) => store.phrasingRevisions[0]?.plainText,
  },
  {
    kind: "template",
    label: "Extra CSS",
    original: "",
    values: [".kc-name { color: red; }", ".kc-name { color: blue; }"],
    savedValue: (store: Store) => store.templates[0]?.spec.extraCss,
  },
  {
    kind: "resume",
    label: "Body size",
    original: "10.5",
    values: ["12", "11"],
    savedValue: (store: Store) => String(store.resumes[0]?.templateConfig["fontSize"]),
  },
  {
    kind: "target",
    label: "Company",
    original: "",
    values: ["First pending company", "Second pending company"],
    savedValue: (store: Store) => store.resumes[0]?.targetCompany,
  },
])(
  "recovers installed $kind edits only in their connected store",
  async ({ kind, label, original, values, savedValue }) => {
    const store = openLocalStore();
    const caches: QueryClient[] = [];
    try {
      await store.migrate();
      const firstOwner = newUuid();
      const secondOwner = newUuid();
      await store.provisionOwner(firstOwner);
      await store.provisionOwner(secondOwner);
      const pointId = newUuid();
      const templateId = newUuid();
      const resumeId = newUuid();
      await runAsOwner(firstOwner, () =>
        store.unitOfWork.run(async (r) => {
          await r.points.create(
            pointInputSchema.parse({
              id: pointId,
              recordId: null,
              phrasingSetId: newUuid(),
              confidence: "verified",
              occurredOn: null,
              sortKey: "a0",
              phrasing: {
                id: newUuid(),
                variant: "standard",
                label: null,
                sortKey: "a0",
                body: [{ t: "text", v: "Original wording" }],
              },
            }),
          );
          await r.templates.create({
            id: templateId,
            name: "Recovery design",
            spec: { settings: {}, extraCss: "" },
          });
          await r.resumes.create(
            resumeInputSchema.parse({
              id: resumeId,
              name: "Recovery resume",
              targetCompany: null,
              targetRole: null,
              targetUrl: null,
              targetJdText: null,
              appliedOn: null,
            }),
          );
        }),
      );
      const archive = await runAsOwner(firstOwner, () =>
        store.unitOfWork.run((r) => r.store.read()),
      );
      await runAsOwner(secondOwner, () => store.unitOfWork.run((r) => r.store.load(archive)));
      const apis = [firstOwner, secondOwner].map((owner, index) =>
        createApi({
          unitOfWork: store.unitOfWork,
          runAsOwner,
          authenticate: sessionTokenAuth(String(index), owner),
          reportUnexpectedError: null,
        }),
      );
      let refuse = true;
      vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
        const request = new Request(url, init);
        if (refuse && request.method !== "GET") return Promise.reject(new Error("Offline"));
        const api = apis[Number(request.headers.get("x-keepcv-session"))];
        if (api === undefined) throw new Error("Unknown connection");
        return api.fetch(request);
      });
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      vi.stubGlobal(
        "URL",
        class extends URL {
          static override createObjectURL(): string {
            return "blob:preview";
          }
          static override revokeObjectURL(): void {}
        },
      );
      const path =
        kind === "wording"
          ? `/points/${pointId}/edit`
          : kind === "template"
            ? `/templates/${templateId}`
            : `/resumes/${resumeId}?view=${kind === "target" ? "target" : "preview"}`;
      const retryName =
        kind === "wording" ? "Retry saving wording" : kind === "target" ? "Save" : "Retry saving";

      async function open(index: number) {
        window.history.replaceState(null, "", path);
        const queries = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
        caches.push(queries);
        const mounted = render(
          <Editor
            api={createClient("http://consumer.test", { sessionToken: String(index) })}
            queries={queries}
            recoveryNamespace={`connection:${index}`}
            signOut={() => mounted.unmount()}
          />,
        );
        await screen.findByLabelText(label);
        return queries;
      }
      async function leave(queries: QueryClient) {
        await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
        await waitFor(() => expect(queries.isMutating()).toBe(0));
        queries.clear();
      }
      async function saveRecovered() {
        if (kind === "wording") {
          refuse = false;
          fireEvent.blur(screen.getByLabelText(label));
        } else {
          const retry = await screen.findByRole("button", { name: retryName });
          refuse = false;
          fireEvent.click(retry);
        }
      }
      for (const index of [0, 1]) {
        const queries = await open(index);
        expect(screen.getByLabelText(label)).toHaveValue(original);
        expect(screen.queryByRole("button", { name: "Restore draft" })).not.toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(label), { target: { value: values[index] } });
        if (kind === "target") {
          for (const [label, value] of Object.entries({
            Role: "Unfinished role",
            Posting: "https://example.test/job",
            "Applied on": "2026-10-13",
            "Job description": "Unfinished description",
          }))
            fireEvent.change(screen.getByLabelText(label), { target: { value } });
        }
        if (kind === "wording") fireEvent.blur(screen.getByLabelText(label));
        if (kind === "target") {
          fireEvent.click(screen.getByRole("button", { name: "Save" }));
          await screen.findByText("Offline");
        } else await screen.findByRole("button", { name: retryName });
        await leave(queries);
      }
      expect(window.localStorage.length).toBe(2);
      for (const index of [0, 1]) {
        const queries = await open(index);
        if (kind === "wording") {
          expect(screen.getByLabelText(label)).toHaveValue(original);
          fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
        }
        expect(screen.getByLabelText(label)).toHaveValue(values[index]);
        if (kind === "target") {
          for (const [label, value] of Object.entries({
            Role: "Unfinished role",
            Posting: "https://example.test/job",
            "Applied on": "2026-10-13",
            "Job description": "Unfinished description",
          }))
            expect(screen.getByLabelText(label)).toHaveValue(value);
        }
        await saveRecovered();
        await waitFor(() => expect(window.localStorage.length).toBe(1 - index));
        await leave(queries);
        refuse = true;
      }
      for (const [index, owner] of [firstOwner, secondOwner].entries()) {
        const saved = await runAsOwner(owner, () =>
          store.unitOfWork.run((r) => r.store.readCurrent()),
        );
        expect(savedValue(saved)).toBe(values[index]);
      }
    } finally {
      cleanup();
      for (const queries of caches) {
        await waitFor(() => expect(queries.isMutating()).toBe(0));
        queries.clear();
      }
      await store.close();
    }
  },
);
