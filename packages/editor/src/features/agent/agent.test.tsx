import { createClient } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { agentConversationSchema } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildRouter } from "../../app/router.js";
import { emptyStore } from "../../store.harness.js";
import { jsonOf } from "../../store-server.harness.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

it("opens chat first, reviews an exact change and refreshes the ordinary editor", async () => {
  const store = emptyStore();
  const id = newUuid();
  const actionId = newUuid();
  const chat = agentConversationSchema.parse({
    id,
    title: "Profile task",
    createdAt: store.profile.createdAt,
    updatedAt: store.profile.updatedAt,
    archivedAt: null,
    messages: [],
    actions: [],
    run: null,
  });
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const request = new Request(url, init);
    const path = new URL(request.url).pathname;
    if (path === "/v1/store") return jsonOf(store);
    if (path === "/v1/agent/capabilities")
      return jsonOf({ available: true, disclosure: "Synthetic model", maxFileBytes: 16777216 });
    if (path === "/v1/agent/conversations")
      return request.method === "POST" ? jsonOf(chat, 201) : jsonOf({ items: [] });
    if (path.endsWith("/attachments")) return jsonOf({ items: [] });
    if (path.endsWith("/turns")) {
      chat.actions.push({
        id: actionId,
        summary: "Set your profile name to Ada",
        operations: [
          {
            type: "profile.update",
            expectedUpdatedAt: store.profile.updatedAt,
            patch: { fullName: "Ada" },
          },
        ],
        status: "pending",
        createdAt: store.profile.createdAt,
        before: JSON.stringify(store.profile),
        receipt: null,
      });
      return new Response(
        'event: status\ndata: {"type":"status","text":"Reading"}\n\nevent: done\ndata: {"type":"done","text":"Saved"}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      );
    }
    if (path.includes("/actions/")) {
      store.profile.fullName = "Ada";
      const action = chat.actions[0];
      if (action === undefined) throw new Error("No proposal");
      action.status = "applied";
      action.receipt = "Applied once";
      return jsonOf(chat);
    }
    return jsonOf(chat);
  });
  window.history.replaceState(null, "", "/");
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter({
    queries,
    api: createClient(window.location.origin),
    signOut: undefined,
  });
  render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("heading", { name: "Your career, in conversation" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("What would you like to do?"), {
    target: { value: "Set my name to Ada" },
  });
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const accept = await screen.findByRole("button", { name: "Accept" });
  await waitFor(() => expect(accept).toBeEnabled());
  expect(store.profile.fullName).toBeNull();
  fireEvent.click(accept);
  expect(await screen.findByText("Applied once")).toBeInTheDocument();
  expect(queries.getQueryData<{ profile: { fullName: string } }>(["store"])?.profile.fullName).toBe(
    "Ada",
  );
  fireEvent.click(screen.getByRole("link", { name: "Profile" }));
  expect(await screen.findByLabelText("Name")).toHaveValue("Ada");
  expect(screen.getByRole("button", { name: "Ask KeepCV" })).toBeInTheDocument();
});
