import "@testing-library/jest-dom/vitest";
import { createAgent } from "@keepcv/agent";
import { createApi, createClient, sessionTokenAuth } from "@keepcv/api";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { Editor } from "@keepcv/editor";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

it("mounts an installed hosted editor, retains its draft through host updates and sends only after consent", async () => {
  const store = openLocalStore();
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const generate = vi.fn(async () => ({
    text: "Synthetic response",
    sources: [],
    navigation: null,
  }));
  const runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generationMediaTypes: ["text/plain", "image/png"], generate },
    disclosure: "Synthetic processing service",
  });
  try {
    await store.migrate();
    const owner = await store.ensureLocalOwner();
    const server = createApi({
      unitOfWork: store.unitOfWork,
      runAsOwner,
      authenticate: sessionTokenAuth("synthetic", owner),
      agent: runtime,
    });
    const writes: string[] = [];
    vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) => {
      const request = new Request(url, init);
      if (request.method !== "GET") writes.push(request.url);
      return server.fetch(request);
    });
    const api = createClient("http://consumer.test", { sessionToken: "synthetic" });
    window.history.replaceState(null, "", "/");
    const view = render(
      <Editor
        api={api}
        queries={queries}
        recoveryNamespace="synthetic-owner"
        sizing="container"
        hostActions={[{ id: "account", label: "Account settings", href: "/account" }]}
      />,
    );
    await screen.findByRole("button", { name: "Review my career" });
    const input = screen.getByRole("textbox", { name: "What would you like to do?" });
    fireEvent.change(input, { target: { value: "Review synthetic career" } });
    view.rerender(
      <Editor
        api={api}
        queries={queries}
        recoveryNamespace="synthetic-owner"
        sizing="container"
        hostActions={[{ id: "privacy", label: "Privacy settings", href: "/privacy" }]}
      />,
    );
    expect(input).toHaveValue("Review synthetic career");
    expect(screen.getByRole("link", { name: "Privacy settings" })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(
      await screen.findByRole("dialog", { name: "Share with the assistant" }),
    ).toHaveTextContent("Synthetic processing service");
    expect(writes).toHaveLength(0);
    expect(generate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(input).toHaveValue("Review synthetic career");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const allow = await screen.findByRole("button", { name: "Allow and send" });
    fireEvent.click(allow);
    fireEvent.click(allow);
    await waitFor(() => expect(generate).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Stop task" })).not.toBeInTheDocument(),
    );
    expect(writes.filter((url) => url.endsWith("/turns"))).toHaveLength(1);
    expect(screen.getByLabelText("Choose attachments")).toHaveAttribute(
      "accept",
      expect.stringContaining("image/png"),
    );
    expect(screen.getByLabelText("Choose attachments").getAttribute("accept")).not.toContain(
      "application/pdf",
    );
  } finally {
    cleanup();
    vi.unstubAllGlobals();
    runtime.close();
    queries.clear();
    await store.close();
  }
}, 60000);
