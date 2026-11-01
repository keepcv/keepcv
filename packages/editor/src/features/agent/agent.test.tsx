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

it.each(["/", "/assistant", "/overview", "/profile", "/conversations"])(
  "hides assistant controls on direct disabled navigation to %s",
  async (path) => {
    vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(new Request(url, init).url).pathname;
      return Promise.resolve(
        pathname === "/v1/store"
          ? jsonOf(emptyStore())
          : pathname.endsWith("capabilities")
            ? jsonOf({ available: true, disclosure: "Synthetic" })
            : jsonOf({ items: [] }),
      );
    });
    window.history.replaceState(null, "", path);
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const router = buildRouter({
      queries,
      api: createClient(window.location.origin),
      signOut: undefined,
      assistant: false,
    });
    render(
      <QueryClientProvider client={queries}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    if (path === "/profile") expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    else if (path === "/assistant" || path === "/conversations")
      expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
    else expect(await screen.findByText("Start with your career")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Assistant" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask KeepCV" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("What would you like to do?")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conversations" })).toBeInTheDocument();
    cleanup();
    queries.clear();
  },
);

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
  let acceptCount = 0;
  let finishDecision = () => {};
  const decisionReady = new Promise<void>((resolve) => {
    finishDecision = resolve;
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
      acceptCount++;
      await decisionReady;
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
  fireEvent.keyDown(screen.getByLabelText("What would you like to do?"), {
    key: "Enter",
    ctrlKey: true,
  });
  const accept = await screen.findByRole("button", { name: "Accept" });
  await waitFor(() => expect(accept).toBeEnabled());
  expect(store.profile.fullName).toBeNull();
  expect(screen.getByText("Change profile")).toBeInTheDocument();
  expect(screen.getByText("full name")).toBeInTheDocument();
  expect(screen.getByRole("log", { name: "Conversation messages" })).toHaveAttribute(
    "aria-relevant",
    "additions",
  );
  fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
  const composer = screen.getByLabelText("What would you like to do?");
  expect(composer).toHaveFocus();
  expect(composer).toHaveValue(
    "Please revise this suggestion: Set your profile name to Ada\n\nMy correction: ",
  );
  fireEvent.change(composer, { target: { value: "My unsent correction" } });
  fireEvent.click(screen.getByRole("button", { name: "Request changes" }));
  expect(composer).toHaveValue("My unsent correction");
  fireEvent.click(accept);
  fireEvent.click(accept);
  await waitFor(() => expect(acceptCount).toBe(1));
  expect(screen.getByRole("status")).toHaveTextContent("Saving your decision...");
  expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  finishDecision();
  expect(await screen.findByText("Applied once")).toBeInTheDocument();
  expect(queries.getQueryData<{ profile: { fullName: string } }>(["store"])?.profile.fullName).toBe(
    "Ada",
  );
  fireEvent.click(screen.getByRole("link", { name: "Profile" }));
  expect(await screen.findByLabelText("Name")).toHaveValue("Ada");
  expect(screen.getByRole("button", { name: "Ask KeepCV" })).toBeInTheDocument();
});

it("keeps download errors visible in disabled history and copies existing AI responses", async () => {
  const store = emptyStore();
  const id = newUuid();
  const fileId = newUuid();
  const chat = agentConversationSchema.parse({
    id,
    title: "Saved discussion",
    createdAt: store.profile.createdAt,
    updatedAt: store.profile.updatedAt,
    archivedAt: null,
    actions: [],
    run: null,
    messages: [
      {
        id: newUuid(),
        role: "assistant",
        text: "Saved response",
        attachmentIds: [],
        sources: [],
        state: "complete",
        navigation: null,
        createdAt: store.profile.createdAt,
      },
    ],
  });
  const copy = vi.fn(() => Promise.resolve());
  vi.stubGlobal("navigator", {
    platform: navigator.platform,
    language: navigator.language,
    userAgent: navigator.userAgent,
    clipboard: { writeText: copy },
  });
  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(new Request(url, init).url).pathname;
    if (path === "/v1/store") return Promise.resolve(jsonOf(store));
    if (path.endsWith("capabilities"))
      return Promise.resolve(jsonOf({ available: false, disclosure: "No provider" }));
    if (path === "/v1/agent/conversations") return Promise.resolve(jsonOf({ items: [chat] }));
    if (path.endsWith("/attachments"))
      return Promise.resolve(
        jsonOf({
          items: [
            {
              id: fileId,
              conversationId: id,
              name: "notes.txt",
              mediaType: "text/plain",
              sizeBytes: 8,
              createdAt: chat.createdAt,
              updatedAt: chat.updatedAt,
              archivedAt: null,
            },
          ],
        }),
      );
    if (path.endsWith(fileId))
      return Promise.resolve(
        jsonOf(
          {
            type: "about:blank",
            title: "Unavailable",
            status: 503,
            detail: "Download unavailable. Try again.",
            instance: path,
          },
          503,
        ),
      );
    return Promise.resolve(jsonOf(chat));
  });
  window.history.replaceState(null, "", "/conversations");
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = buildRouter({
    queries,
    api: createClient(window.location.origin),
    signOut: undefined,
    assistant: false,
  });
  render(
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByRole("combobox", { name: "Conversation" }), {
    target: { value: id },
  });
  expect(await screen.findByText("Saved response")).toBeInTheDocument();
  const transcript = screen.getByRole("region", { name: "Conversation transcript" });
  Object.defineProperties(transcript, {
    scrollHeight: { configurable: true, value: 1000 },
    clientHeight: { configurable: true, value: 300 },
  });
  transcript.scrollTop = 100;
  fireEvent.scroll(transcript);
  fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
  expect(transcript.scrollTop).toBe(1000);
  fireEvent.click(screen.getByRole("button", { name: "Copy response" }));
  await waitFor(() => expect(copy).toHaveBeenCalledWith("Saved response"));
  expect(await screen.findByRole("button", { name: "Copied response" })).toBeInTheDocument();
  fireEvent.click(screen.getByText("Saved attachments"));
  fireEvent.click(await screen.findByRole("button", { name: "Download" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Download unavailable. Try again.");
  expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  cleanup();
  queries.clear();
});
