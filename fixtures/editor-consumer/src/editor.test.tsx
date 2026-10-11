import "@testing-library/jest-dom/vitest";
import { createApi, createClient, sessionTokenAuth } from "@keepcv/api";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { Editor } from "@keepcv/editor";
import type { Store } from "@keepcv/schema";
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
    expect(await screen.findByText("Nothing in the store yet")).toBeInTheDocument();
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
