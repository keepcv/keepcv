import { createClient } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { agentConversationSchema } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Editor } from "../index.js";
import { emptyStore } from "../store.harness.js";
import { jsonOf } from "../store-server.harness.js";

const caches: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const cache of caches) cache.clear();
  caches.length = 0;
  vi.unstubAllGlobals();
  localStorage.clear();
});
function setup(web = true, turnResponse?: () => Response) {
  const store = emptyStore();
  const chat = agentConversationSchema.parse({
    id: newUuid(),
    title: "Synthetic",
    createdAt: store.profile.createdAt,
    updatedAt: store.profile.updatedAt,
    archivedAt: null,
    messages: [],
    actions: [],
    run: null,
  });
  const effective = {
    available: true,
    disclosure: "Synthetic processing destination",
    webSearchAvailable: web,
    generationMediaTypes: ["text/plain", "image/png"],
  };
  const stored: Record<string, unknown>[] = [];
  const mutations: Request[] = [];
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  caches.push(queries);
  const api = createClient(window.location.origin);
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const req = new Request(url, init);
    const path = new URL(req.url).pathname;
    if (req.method !== "GET") mutations.push(req);
    if (path === "/v1/store") return jsonOf(store);
    if (path.endsWith("capabilities")) return jsonOf(effective);
    if (path.endsWith("/turns"))
      return (
        turnResponse?.() ??
        new Response(
          'data: {"type":"status","text":"Reading"}\n\ndata: {"type":"done","text":"Saved"}\n\n',
        )
      );
    if (path.endsWith("/conversations"))
      return req.method === "POST"
        ? jsonOf(chat, 201)
        : jsonOf({ items: stored.length ? [chat] : [] });
    if (path.endsWith("attachments")) return jsonOf({ items: stored });
    return req.method === "PUT" ? jsonOf({ saved: true }) : jsonOf(chat);
  });
  window.history.replaceState(null, "", "/");
  const view = render(<Editor api={api} queries={queries} recoveryNamespace="synthetic-owner" />);
  return { api, queries, mutations, view, effective, chat, stored };
}
async function draft() {
  await screen.findByRole("button", { name: "Review my career" });
  const input = await screen.findByRole("textbox", { name: "What would you like to do?" });
  fireEvent.change(input, { target: { value: "Review my career" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  return input;
}

it.each(["mouse", "keyboard"])(
  "asks before any write via %s and preserves canceled input",
  async (mode) => {
    const { mutations, queries } = setup();
    const input = await draft();
    input.focus();
    if (mode === "mouse") fireEvent.click(screen.getByRole("button", { name: "Send" }));
    else fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(queries.isFetching()).toBe(0));
    expect(mutations).toHaveLength(0);
    const dialog = await screen.findByRole("dialog", { name: "Share with the assistant" });
    expect(dialog).toHaveAccessibleDescription();
    expect(within(dialog).getByText("Synthetic processing destination")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Use Web search")).toBeChecked();
    expect(mutations).toHaveLength(0);
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("Review my career");
    expect(mutations).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(mutations).toHaveLength(0);
  },
);

it("submits once after affirmation, retains acknowledgment across chats and invalidates changed scope", async () => {
  const { mutations, effective } = setup();
  const input = await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const allow = await screen.findByRole("button", { name: "Allow and send" });
  fireEvent.click(allow);
  fireEvent.click(allow);
  fireEvent.keyDown(input, { key: "Enter", metaKey: true });
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
  );
  expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
  fireEvent.change(input, { target: { value: "Another request" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(2));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
  );
  effective.disclosure = "Changed destination";
  fireEvent.change(input, { target: { value: "New scope" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("Changed destination"));
  expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(2);
});

it("preserves explicit web opt-out and refuses a changed draft while consent is open", async () => {
  const { mutations } = setup();
  const input = await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "Use Web search" }));
  expect(screen.getByRole("dialog")).toHaveTextContent("Web search is off");
  fireEvent.change(input, { target: { value: "Changed behind dialog" } });
  fireEvent.click(screen.getByRole("button", { name: "Allow and send" }));
  expect(mutations).toHaveLength(0);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(await screen.findByRole("button", { name: "Allow and send" }));
  await waitFor(() => expect(mutations.some((r) => r.url.endsWith("/turns"))).toBe(true));
  expect(
    await mutations
      .find((r) => r.url.endsWith("/turns"))
      ?.clone()
      .json(),
  ).toMatchObject({ text: "Changed behind dialog", webSearchEnabled: false, disclosure: true });
});

it("updates host chrome without discarding drafts and isolates another connection", async () => {
  const { api, queries, view, mutations } = setup();
  const input = await draft();
  const action = vi.fn();
  view.rerender(
    <Editor
      api={api}
      queries={queries}
      recoveryNamespace="synthetic-owner"
      sizing="container"
      hostActions={[
        { id: "account", label: "Account settings", onSelect: action },
        { id: "unsafe", label: "Unsafe", href: "javascript:alert(1)" },
      ]}
    />,
  );
  expect(input).toHaveValue("Review my career");
  expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
  expect(action).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const stale = await screen.findByRole("button", { name: "Allow and send" });
  const nextQueries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  caches.push(nextQueries);
  view.rerender(<Editor api={api} queries={nextQueries} recoveryNamespace="other-owner" />);
  fireEvent.click(stale);
  await screen.findByRole("textbox", { name: "What would you like to do?" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(mutations).toHaveLength(0);
  expect(screen.getByRole("textbox")).toHaveValue("");
});

it("uses effective formats for file chooser and rejects unsupported PDF drops before writes", async () => {
  const { mutations } = setup(false);
  await draft();
  expect(screen.getByLabelText("Choose attachments")).toHaveAttribute(
    "accept",
    expect.stringContaining(".md"),
  );
  expect(screen.getByLabelText("Choose attachments").getAttribute("accept")).not.toContain(
    "application/pdf",
  );
  fireEvent.drop(screen.getByRole("textbox").closest("form")!, {
    dataTransfer: { files: [new File(["%PDF"], "synthetic.pdf", { type: "application/pdf" })] },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable for generation");
  expect(mutations).toHaveLength(0);
});

it("preserves a file-only request and traps focus without preacceptance", async () => {
  const { mutations } = setup();
  await screen.findByRole("button", { name: "Review my career" });
  fireEvent.change(screen.getByLabelText("Choose attachments"), {
    target: { files: [new File(["Synthetic notes"], "notes.md", { type: "text/markdown" })] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog).toHaveTextContent("1 selected files or originals");
  const allow = within(dialog).getByRole("button", { name: "Allow and send" });
  allow.focus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(allow).toHaveFocus();
  fireEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
  expect(screen.getByRole("button", { name: "Remove notes.md" })).toBeInTheDocument();
  expect(mutations).toHaveLength(0);
});
it("prevents submission when generation authority changes while the dialog is open", async () => {
  const { queries, mutations } = setup();
  await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("dialog");
  queries.setQueryData(["agent", "capabilities"], {
    ...queries.getQueryData<object>(["agent", "capabilities"]),
    available: false,
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeDisabled());
  expect(mutations).toHaveLength(0);
});
it.each(["legacy", "structured", "interrupted"])(
  "retains safe %s stream failures and exposes host recovery",
  async (mode) => {
    const { api, queries, view, mutations } = setup(
      false,
      () =>
        new Response(
          mode === "interrupted"
            ? 'data: {"type":"text","text":"Partial"}\n\n'
            : `data: ${JSON.stringify({ type: "error", text: "Synthetic refusal", ...(mode === "structured" ? { problem: { type: "about:blank", title: "Temporary refusal", status: 429, detail: "Synthetic refusal", instance: "/v1/agent" }, retryAfter: "15" } : {}) })}\n\n`,
        ),
    );
    const recover = vi.fn(() => [{ id: "help", label: "Contact support", href: "/help" }]);
    view.rerender(
      <Editor
        api={api}
        queries={queries}
        recoveryNamespace="synthetic-owner"
        recoveryActions={recover}
      />,
    );
    await draft();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Allow and send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      mode === "interrupted" ? "interrupted" : "Synthetic refusal",
    );
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute(
      "href",
      expect.stringContaining("/help"),
    );
    if (mode === "structured")
      expect(recover).toHaveBeenCalledWith(
        expect.objectContaining({
          problem: expect.objectContaining({ status: 429 }),
          retryAfter: "15",
        }),
      );
    expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(1);
  },
);

it("revokes only future sharing while active work exposes separate Stop", async () => {
  let finish: (() => void) | undefined;
  const response = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"status","text":"Reading"}\n\n'));
      finish = () => {
        controller.enqueue(new TextEncoder().encode('data: {"type":"done","text":"Saved"}\n\n'));
        controller.close();
      };
    },
  });
  const { mutations } = setup(false, () => new Response(response));
  await draft();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  fireEvent.click(await screen.findByRole("button", { name: "Allow and send" }));
  await screen.findByRole("button", { name: "Stop task" });
  fireEvent.click(screen.getByRole("button", { name: "Add files and tools" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Conversation settings" }));
  const settings = screen.getByRole("dialog");
  fireEvent.click(within(settings).getByRole("checkbox"));
  expect(settings).toHaveTextContent("current task continues");
  expect(within(settings).getByRole("button", { name: "Stop task" })).toBeEnabled();
  expect(mutations.filter((r) => r.url.endsWith("/cancel"))).toHaveLength(0);
  finish?.();
  fireEvent.click(within(settings).getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "New task" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("dialog")).toHaveTextContent("Share with the assistant");
  expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(1);
});

it("retains selected originals when first-send consent is canceled", async () => {
  const { queries, chat, stored, mutations } = setup();
  await draft();
  stored.push({
    ...chat,
    id: newUuid(),
    conversationId: chat.id,
    name: "original.md",
    mediaType: "text/plain",
    sizeBytes: 12,
  });
  await queries.invalidateQueries({ queryKey: ["agent", "conversations"] });
  expect(queries.getQueryData(["agent", "conversations"])).toMatchObject([{ id: chat.id }]);
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  const history = await screen.findByRole("dialog", { name: "Conversation history" });
  await waitFor(() => expect(history).toHaveTextContent("Synthetic"));
  fireEvent.click(within(history).getByRole("button", { name: "Synthetic" }));
  const include = await screen.findByRole("checkbox", {
    name: "Include original.md",
    hidden: true,
  });
  const details = include.closest("details");
  if (details) details.open = true;
  fireEvent.click(include);
  fireEvent.change(screen.getByRole("textbox", { name: "What would you like to do?" }), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("dialog", { name: "Share with the assistant" })).toHaveTextContent(
    "1 selected files or originals",
  );
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(include).toBeChecked();
  expect(
    mutations.filter(
      (r) => r.url.endsWith("/turns") || (r.method === "POST" && r.url.includes("/attachments/")),
    ),
  ).toHaveLength(0);
});

it.each(["synthetic-owner", "different-owner"])(
  "starts fresh sharing after remount for %s",
  async (namespace) => {
    const { api, queries, view, mutations } = setup();
    await draft();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Allow and send" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
    );
    view.unmount();
    const freshQueries = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    caches.push(freshQueries);
    render(<Editor api={api} queries={freshQueries} recoveryNamespace={namespace} />);
    await draft();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("dialog", { name: "Share with the assistant" }),
    ).toBeInTheDocument();
    expect(mutations.filter((r) => r.url.endsWith("/turns"))).toHaveLength(1);
    queries.clear();
  },
);

it("offers host recovery from a root authentication failure without replaying a request", async () => {
  window.history.replaceState(null, "", "/");
  const requests = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          type: "about:blank",
          title: "Sign in required",
          status: 401,
          detail: "Synthetic session expired",
          instance: "/v1/store",
        }),
        { status: 401, headers: { "Retry-After": "120" } },
      ),
  );
  vi.stubGlobal("fetch", requests);
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  caches.push(queries);
  const recover = vi.fn();
  const actions = vi.fn(() => [{ id: "signin", label: "Sign in again", onSelect: recover }]);
  render(
    <div style={{ height: 240 }}>
      <Editor
        api={createClient(window.location.origin)}
        queries={queries}
        sizing="container"
        recoveryActions={actions}
      />
    </div>,
  );
  const action = await screen.findByRole("button", { name: "Sign in again" });
  expect(actions).toHaveBeenCalledWith(
    expect.objectContaining({
      problem: expect.objectContaining({ status: 401 }),
      retryAfter: "120",
    }),
  );
  const count = requests.mock.calls.length;
  fireEvent.click(action);
  expect(recover).toHaveBeenCalledOnce();
  expect(requests).toHaveBeenCalledTimes(count);
});
