import "@testing-library/jest-dom/vitest";
import { createApi, createClient, sessionTokenAuth } from "@keepcv/api";
import { NotFoundError, newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { type DataPagePresentation, Editor } from "@keepcv/editor";
import { exportDocumentSchema, pointSchema, type Store } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { createRootRoute, createRouter } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const hostRouter = createRouter({ routeTree: createRootRoute() });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof hostRouter;
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it("uses installed entry points for keyboard navigation, writes, cache and sign-out", async () => {
  const store = openLocalStore();
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  try {
    await store.migrate();
    const owner = await store.ensureLocalOwner();
    const api = createApi({
      unitOfWork: store.unitOfWork,
      runAsOwner,
      authenticate: sessionTokenAuth("consumer", owner),
    });
    const requests: string[] = [];
    vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
      const request = new Request(url, init);
      requests.push(request.url);
      return api.fetch(request);
    });
    window.history.replaceState(null, "", "/");
    const signOut = vi.fn();
    render(
      <Editor
        api={createClient("http://consumer.test", { sessionToken: "consumer" })}
        queries={queries}
        signOut={signOut}
      />,
    );
    expect(await screen.findByText("Start with your career")).toBeInTheDocument();
    expect(queries.getQueryData<Store>(["store"])?.profile.id).toBeDefined();
    expect(requests).toEqual(["http://consumer.test/v1/store"]);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const search = await screen.findByRole("combobox");
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "Profile" } });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    const name = await screen.findByLabelText("Name");
    fireEvent.change(name, { target: { value: "Ada Consumer" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() =>
      expect(queries.getQueryData<Store>(["store"])?.profile.fullName).toBe("Ada Consumer"),
    );
    expect(
      await runAsOwner(owner, () => store.unitOfWork.run((r) => r.profile.get())),
    ).toMatchObject({ fullName: "Ada Consumer" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledOnce();
  } finally {
    cleanup();
    queries.clear();
    await store.close();
  }
});

it("renders a refused request without assuming a launcher authentication mode", async () => {
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Credentials expired.",
          instance: "/v1/store",
        }),
        { status: 401 },
      ),
    ),
  );
  window.history.replaceState(null, "", "/");
  render(<Editor api={createClient("http://consumer.test")} queries={queries} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Credentials expired.");
  expect(screen.getByText(/Sign in again through the application/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  cleanup();
  queries.clear();
});

const connectedDataPage: DataPagePresentation = {
  storageDescription: "Saved by the connected application.",
  backupDescription: "Download a copy you control.",
  restoreDescription: "Choose an empty store to restore into.",
  showTerminalInstructions: false,
};

it.each([undefined, connectedDataPage])(
  "uses installed data-page guidance while preserving native backup and restore",
  async (dataPage) => {
    const store = openLocalStore();
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    try {
      await store.migrate();
      const owner = await store.ensureLocalOwner();
      const api = createApi({
        unitOfWork: store.unitOfWork,
        runAsOwner,
        authenticate: sessionTokenAuth("consumer", owner),
      });
      vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) =>
        api.fetch(new Request(url, init)),
      );
      const client = createClient("http://consumer.test", { sessionToken: "consumer" });
      const phrasingId = newUuid();
      const created = await client.v1.points.$post({
        json: {
          id: newUuid(),
          recordId: null,
          phrasingSetId: newUuid(),
          confidence: "verified",
          occurredOn: null,
          sortKey: "a0",
          phrasing: {
            id: phrasingId,
            variant: "standard",
            label: null,
            sortKey: "a0",
            body: [{ t: "text", v: "Original wording" }],
          },
        },
      });
      expect(created.status).toBe(201);
      const point = pointSchema.parse(await created.json());
      expect(
        (
          await client.v1.phrasings[":id"].revisions.$post({
            param: { id: phrasingId },
            json: { body: [{ t: "text", v: "Revised wording" }] },
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await client.v1.points[":id"].$delete({
            param: { id: point.id },
            json: { expectedUpdatedAt: point.updatedAt },
          })
        ).status,
      ).toBe(200);
      const archive = exportDocumentSchema.parse(
        await (await client.v1.export.$get({ query: { format: "native" } })).json(),
      );
      expect(archive.store.points[0]?.archivedAt).not.toBeNull();
      expect(archive.store.phrasingRevisions.map((row) => row.plainText)).toEqual([
        "Original wording",
        "Revised wording",
      ]);
      const blobs: Blob[] = [];
      vi.stubGlobal(
        "URL",
        class extends URL {
          static override createObjectURL(blob: Blob | MediaSource): string {
            blobs.push(blob as Blob);
            return "blob:backup";
          }
          static override revokeObjectURL(): void {}
        },
      );
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      window.history.replaceState(null, "", "/data");
      render(<Editor api={client} queries={queries} dataPage={dataPage} />);
      const backup = await screen.findByRole("button", { name: "Download a backup" });
      if (dataPage === undefined) {
        expect(screen.getByText("From a terminal")).toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveTextContent("keepcv backup");
      } else {
        expect(screen.getByText(dataPage.storageDescription)).toBeInTheDocument();
        expect(screen.getByRole("main")).toHaveTextContent(dataPage.backupDescription);
        expect(screen.getByRole("main")).toHaveTextContent(dataPage.restoreDescription);
        expect(screen.getByRole("main")).not.toHaveTextContent(
          /launcher|machine|disk|--data-dir|From a terminal/,
        );
        expect(screen.getByRole("main").querySelector("pre")).toBeNull();
      }
      fireEvent.click(backup);
      await waitFor(() => expect(blobs).toHaveLength(1));
      const downloaded = exportDocumentSchema.parse(JSON.parse((await blobs[0]?.text()) ?? "null"));
      expect(downloaded.store).toEqual(archive.store);
      fireEvent.change(screen.getByLabelText("A backup file to load"), {
        target: {
          files: [new File([JSON.stringify(archive)], "backup.json", { type: "application/json" })],
        },
      });
      expect(await screen.findByRole("alert")).toHaveTextContent(/already holds|empty store/i);
      const after = exportDocumentSchema.parse(
        await (await client.v1.export.$get({ query: { format: "native" } })).json(),
      );
      expect(after.store).toEqual(archive.store);
    } finally {
      cleanup();
      queries.clear();
      vi.restoreAllMocks();
      await store.close();
    }
  },
);

it("consumes provisioning and erasure from the installed database package", async () => {
  const store = openLocalStore();
  try {
    await store.migrate();
    const first = newUuid();
    const second = newUuid();
    await Promise.all([
      store.provisionOwner(first),
      store.provisionOwner(first),
      store.provisionOwner(second),
    ]);
    const read = (id: typeof first) =>
      runAsOwner(id, () => store.unitOfWork.run((r) => r.profile.get()));
    const original = await read(first);
    const kept = await read(second);
    await store.eraseOwner(first, { erasePermanently: true });
    await expect(read(first)).rejects.toBeInstanceOf(NotFoundError);
    await store.eraseOwner(first, { erasePermanently: true });
    expect(await read(second)).toEqual(kept);
    await store.provisionOwner(first);
    const fresh = await read(first);
    expect(fresh.id).not.toBe(original.id);
    expect(fresh.fullName).toBeNull();
  } finally {
    await store.close();
  }
});
