import { createClient } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { agentConversationSchema } from "@keepcv/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildRouter } from "../../app/router.js";
import { addRecord, emptyStore } from "../../store.harness.js";
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
    await screen.findByRole("heading", { name: "What are we working on?" }),
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
  fireEvent.click(screen.getByRole("button", { name: "Ask KeepCV" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/assistant"));
  expect(screen.queryByRole("dialog", { name: "Ask KeepCV" })).not.toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "What are we working on?" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Applied once")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "/profile" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove page context" }));
  expect(screen.queryByText("Page context:")).not.toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Web search" })).not.toBeChecked();
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
  fireEvent.click(await screen.findByRole("button", { name: "Saved discussion" }));
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

it.each([false, true])(
  "distinguishes acknowledged Stop from lease refusal (acknowledged=%s)",
  async (acknowledged) => {
    const store = emptyStore();
    const id = newUuid();
    const chat = agentConversationSchema.parse({
      id,
      title: "Running",
      createdAt: store.profile.createdAt,
      updatedAt: store.profile.updatedAt,
      archivedAt: null,
      messages: [],
      actions: [],
      run: null,
    });
    let closeStream = () => {};
    let turns = 0;
    const detail =
      "No local task was confirmed stopped. Its running lease remains; wait for lease expiry or stop it in the process executing the task. Local task access was cleared.";
    vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
      const request = new Request(url, init);
      const path = new URL(request.url).pathname;
      if (path === "/v1/store") return Promise.resolve(jsonOf(store));
      if (path.endsWith("capabilities"))
        return Promise.resolve(jsonOf({ available: true, disclosure: "Synthetic" }));
      if (path === "/v1/agent/conversations")
        return Promise.resolve(
          request.method === "POST" ? jsonOf(chat, 201) : jsonOf({ items: [] }),
        );
      if (path.endsWith("/attachments")) return Promise.resolve(jsonOf({ items: [] }));
      if (path.endsWith("/cancel"))
        return Promise.resolve(
          acknowledged
            ? jsonOf({ saved: true })
            : jsonOf(
                { type: "about:blank", title: "Conflict", status: 409, detail, instance: path },
                409,
              ),
        );
      if (path.endsWith("/turns")) {
        turns++;
        return Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(
                  new TextEncoder().encode(
                    'event: status\ndata: {"type":"status","text":"Reading"}\n\n',
                  ),
                );
                request.signal.addEventListener(
                  "abort",
                  () =>
                    controller.error(
                      new DOMException("BodyStreamBuffer was aborted", "AbortError"),
                    ),
                  { once: true },
                );
                closeStream = () => {
                  if (!request.signal.aborted) controller.close();
                };
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          ),
        );
      }
      return Promise.resolve(jsonOf(chat));
    });
    window.history.replaceState(null, "", "/");
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const router = buildRouter({
      queries,
      api: createClient(window.location.origin),
      signOut: undefined,
    });
    try {
      render(
        <QueryClientProvider client={queries}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );
      await waitFor(() =>
        expect(queries.getQueryData(["agent", "capabilities"])).toMatchObject({ available: true }),
      );
      fireEvent.change(await screen.findByRole("textbox", { name: "What would you like to do?" }), {
        target: { value: "Review" },
      });
      fireEvent.click(screen.getByRole("checkbox"));
      await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Reading"));
      fireEvent.click(screen.getByRole("button", { name: "Stop task" }));
      if (acknowledged) {
        await waitFor(() =>
          expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
        );
        expect(screen.getByRole("status")).toHaveTextContent("Stop requested");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      } else {
        expect(await screen.findByRole("alert")).toHaveTextContent(detail);
        expect(screen.getByRole("status")).not.toHaveTextContent("Stop requested");
      }
      expect(turns).toBe(1);
    } finally {
      closeStream();
      cleanup();
      queries.clear();
    }
  },
);

it("opens the legacy history URL in the unified workspace and finds archived conversations", async () => {
  const store = emptyStore();
  const chats = ["Career review", "Archived application"].map((title, index) =>
    agentConversationSchema.parse({
      id: newUuid(),
      title,
      createdAt: store.profile.createdAt,
      updatedAt: store.profile.updatedAt,
      archivedAt: index === 0 ? null : store.profile.updatedAt,
      messages: [
        {
          id: newUuid(),
          role: "assistant",
          text: title + " response",
          attachmentIds: [],
          sources: [],
          state: "complete",
          navigation: null,
          createdAt: store.profile.createdAt,
        },
      ],
      actions: [],
      run: null,
    }),
  );
  vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
    const request = new Request(url, init);
    const path = new URL(request.url).pathname;
    if (path === "/v1/store") return Promise.resolve(jsonOf(store));
    if (path.endsWith("capabilities"))
      return Promise.resolve(jsonOf({ available: true, disclosure: "Synthetic" }));
    if (path === "/v1/agent/conversations") return Promise.resolve(jsonOf({ items: chats }));
    if (path.endsWith("/attachments")) return Promise.resolve(jsonOf({ items: [] }));
    if (path.endsWith("/grant")) return Promise.resolve(jsonOf({ saved: true }));
    return Promise.resolve(jsonOf(chats.find((chat) => path.endsWith(chat.id))));
  });
  window.history.replaceState(null, "", "/conversations");
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const router = buildRouter({
    queries,
    api: createClient(window.location.origin),
    signOut: undefined,
  });
  try {
    render(
      <QueryClientProvider client={queries}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Assistant" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/assistant");
    expect(screen.queryByRole("link", { name: "Conversations" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Store" })).queryByRole("button", {
        name: "Career review",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const history = within(screen.getByRole("dialog", { name: "Conversation history" }));
    expect(await history.findByRole("button", { name: "Career review" })).toBeInTheDocument();
    fireEvent.change(history.getByRole("textbox", { name: "Search conversations" }), {
      target: { value: "application" },
    });
    expect(history.getByText("No matching conversations.")).toBeInTheDocument();
    fireEvent.click(history.getByRole("checkbox", { name: "Archived" }));
    fireEvent.click(history.getByRole("button", { name: "Archived application" }));
    expect(await screen.findByText("Archived application response")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore conversation" })).toBeInTheDocument();
  } finally {
    cleanup();
    queries.clear();
  }
});

it.each(["profile", "record edit"])("sends Ask KeepCV source context from %s", async (source) => {
  const store = emptyStore();
  const record = addRecord(store);
  const path = source === "profile" ? "/profile" : `/records/${record.id}/edit`;
  const chat = agentConversationSchema.parse({
    id: newUuid(),
    title: "Context task",
    createdAt: store.profile.createdAt,
    updatedAt: store.profile.updatedAt,
    archivedAt: null,
    messages: [],
    actions: [],
    run: null,
  });
  const turns: unknown[] = [];
  const grants: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const request = new Request(url, init);
    const pathname = new URL(request.url).pathname;
    if (pathname === "/v1/store") return jsonOf(store);
    if (pathname.endsWith("capabilities"))
      return jsonOf({ available: true, webSearchAvailable: true, disclosure: "Synthetic" });
    if (pathname === "/v1/agent/conversations")
      return request.method === "POST" ? jsonOf(chat, 201) : jsonOf({ items: [] });
    if (pathname.endsWith("/attachments")) return jsonOf({ items: [] });
    if (pathname.endsWith("/grant")) {
      grants.push(await request.json());
      return jsonOf(chat);
    }
    if (pathname.endsWith("/turns")) {
      turns.push(await request.json());
      return new Response('event: done\ndata: {"type":"done","text":"Saved"}\n\n', {
        headers: { "content-type": "text/event-stream" },
      });
    }
    return jsonOf(chat);
  });
  window.history.replaceState(null, "", path);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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
  fireEvent.click(await screen.findByRole("button", { name: "Ask KeepCV" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/assistant"));
  expect(await screen.findByRole("link", { name: path })).toBeInTheDocument();
  expect(turns).toHaveLength(0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Conversation settings" }));
  expect(screen.getByRole("switch", { name: "Web search" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("switch", { name: "Web search" }));
  fireEvent.change(screen.getByLabelText("Public search query"), {
    target: { value: "  exact public question  " },
  });
  fireEvent.change(screen.getByLabelText(/Approved public page URLs/), {
    target: { value: "https://example.com/public" },
  });
  fireEvent.click(screen.getByLabelText(/Share these exact public URLs/));
  for (const text of ["Read this page", "Read it again"]) {
    if (text === "Read it again") {
      fireEvent.click(screen.getByRole("switch", { name: "Web search" }));
      fireEvent.change(screen.getByLabelText(/Approved public page URLs/), {
        target: { value: "https://example.com/other" },
      });
      expect(screen.getByLabelText(/Share these exact public URLs/)).not.toBeChecked();
    }
    fireEvent.change(screen.getByLabelText("What would you like to do?"), {
      target: { value: text },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Saved");
  }
  expect(turns).toHaveLength(2);
  expect(turns[0]).toMatchObject({
    webSearchEnabled: true,
    publicResearchQuery: "  exact public question  ",
    publicPages: { urls: ["https://example.com/public"], disclosure: true },
  });
  expect(turns[1]).not.toHaveProperty("publicPages");
  expect(turns[1]).toMatchObject({ webSearchEnabled: false });
  expect(turns[1]).not.toHaveProperty("publicResearchQuery");
  for (const turn of turns)
    expect(turn).toMatchObject({
      context: {
        path,
        ...(source === "record edit" ? { resourceId: record.id } : {}),
      },
    });
  if (source === "record edit") {
    fireEvent.click(screen.getByRole("button", { name: "Review before saving" }));
    fireEvent.click(screen.getByRole("button", { name: "Allow task edits" }));
    await screen.findByRole("button", { name: "Task edits on" });
    expect(grants).toContainEqual({
      grant: { resources: ["records", record.id], expiresInSeconds: 600, writes: 5 },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
  expect(screen.queryByText("Page context:")).not.toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Web search" })).not.toBeChecked();
  queries.clear();
});
