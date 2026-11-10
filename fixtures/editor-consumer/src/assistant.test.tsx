import "@testing-library/jest-dom/vitest";
import { type AgentModel, createAgent } from "@keepcv/agent";
import { createApi, createClient, sessionTokenAuth } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { Editor } from "@keepcv/editor";
import { exportDocumentSchema, profileSchema } from "@keepcv/schema";
import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it.each([
  { assistant: false, path: "/" },
  { assistant: false, path: "/assistant" },
  { assistant: true, path: "/", home: "overview" as const },
])(
  "keeps installed history and editing usable with configured presentation: %j",
  async (config) => {
    const store = openLocalStore();
    const queries = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const model: AgentModel = {
      webSearchAvailable: true,
      generate: vi.fn(() => Promise.reject(new Error("Provider unavailable"))),
    };
    let generationAllowed = false;
    const runtime = createAgent({
      unitOfWork: store.unitOfWork,
      model,
      disclosure: "Synthetic provider",
      authorize: () =>
        generationAllowed
          ? Promise.resolve()
          : Promise.reject(new Error("Generation disabled by consumer")),
      limits: { maxAttachments: 1 },
    });
    try {
      await store.migrate();
      const owner = await store.ensureLocalOwner();
      const id = newUuid();
      const fileId = newUuid();
      await runAsOwner(owner, () =>
        store.unitOfWork.run(async (r) => {
          const conversation = await r.agent.create(id, "Saved task");
          conversation.messages.push({
            id: newUuid(),
            role: "user",
            text: "Previously authored career note",
            attachmentIds: [fileId],
            sources: [],
            navigation: null,
            state: "complete",
            createdAt: conversation.createdAt,
          });
          await r.agent.save(conversation);
          await r.agent.attach({
            id: fileId,
            conversationId: id,
            name: "notes.txt",
            mediaType: "text/plain",
            data: "T3JpZ2luYWw=",
          });
        }),
      );
      const api = createApi({
        unitOfWork: store.unitOfWork,
        runAsOwner,
        authenticate: sessionTokenAuth("consumer", owner),
        agent: runtime,
        agentScope: () => Promise.resolve("trusted-session"),
        agentLimits: { maxTextCharacters: 40 },
      });
      vi.stubGlobal("fetch", (url: string | URL | Request, init?: RequestInit) =>
        api.fetch(new Request(url, init)),
      );
      const client = createClient("http://consumer.test", { sessionToken: "consumer" });
      window.history.replaceState(null, "", config.path);
      render(
        <Editor api={client} queries={queries} assistant={config.assistant} home={config.home} />,
      );
      if (config.path === "/assistant") {
        expect(await screen.findByRole("heading", { name: "Conversations" })).toBeInTheDocument();
      } else {
        expect(await screen.findByText("Start with your career")).toBeInTheDocument();
      }
      if (!config.assistant) {
        expect(screen.queryByRole("link", { name: "Assistant" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ask KeepCV" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("What would you like to do?")).not.toBeInTheDocument();
      } else {
        expect(screen.getByRole("button", { name: "Ask KeepCV" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("link", { name: "Assistant" }));
        await waitFor(() =>
          expect(screen.getByLabelText("What would you like to do?")).toHaveAttribute(
            "maxlength",
            "40",
          ),
        );
      }
      if (config.assistant) {
        const search = screen.getByRole("switch", { name: "Web search" });
        expect(search).toBeEnabled();
        expect(search).not.toBeChecked();
        fireEvent.click(search);
        expect(screen.getByLabelText("Public search query")).toBeInTheDocument();
        fireEvent.click(search);
        expect(screen.queryByLabelText("Public search query")).not.toBeInTheDocument();
      }
      if (!config.assistant) {
        fireEvent.click(screen.getByRole("link", { name: "Conversations" }));
        await screen.findByRole("heading", { name: "Conversations" });
      } else {
        expect(screen.queryByRole("link", { name: "Conversations" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "History" }));
      }
      fireEvent.click(await screen.findByRole("button", { name: "Saved task" }));
      expect(await screen.findByText("Previously authored career note")).toBeInTheDocument();
      fireEvent.click(screen.getByText("Saved attachments"));
      const blobs: Blob[] = [];
      vi.stubGlobal(
        "URL",
        class extends URL {
          static override createObjectURL(blob: Blob | MediaSource) {
            blobs.push(blob as Blob);
            return "blob:attachment";
          }
          static override revokeObjectURL() {}
        },
      );
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      fireEvent.click(await screen.findByRole("button", { name: "Download" }));
      await waitFor(() => expect(blobs).toHaveLength(1));
      expect(await blobs[0]?.text()).toBe("Original");
      if (config.assistant) expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
      else expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("link", { name: /^Profile/ }));
      fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Ada Consumer" } });
      fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
      await waitFor(async () =>
        expect(
          await runAsOwner(owner, () => store.unitOfWork.run((r) => r.profile.get())),
        ).toMatchObject({ fullName: "Ada Consumer" }),
      );
      const backup = exportDocumentSchema.parse(
        await (await client.v1.export.$get({ query: { format: "native" } })).json(),
      );
      expect(backup.store.agentHistory[0]?.messages[0]?.text).toBe(
        "Previously authored career note",
      );
      expect(backup.store.agentAttachments[0]?.data).toBe("T3JpZ2luYWw=");
      expect(model.generate).not.toHaveBeenCalled();
      const request = {
        id: newUuid(),
        text: "Review",
        attachmentIds: [],
        context: { path: "/profile" },
        disclosure: true as const,
      };
      const refused = await client.v1.agent.conversations[":id"].turns.$post({
        param: { id },
        json: request,
      });
      expect(await refused.text()).toContain("Task authority was refused.");
      expect(model.generate).not.toHaveBeenCalled();
      generationAllowed = true;
      const failed = await client.v1.agent.conversations[":id"].turns.$post({
        param: { id },
        json: { ...request, id: newUuid() },
      });
      expect(await failed.text()).toContain("could not finish");
      expect(model.generate).toHaveBeenCalledOnce();
      const profile = profileSchema.parse(await (await client.v1.profile.$get()).json());
      expect(
        (
          await client.v1.profile.$patch({
            json: { expectedUpdatedAt: profile.updatedAt, patch: { headline: "Still editable" } },
          })
        ).status,
      ).toBe(200);
      expect((await client.v1.export.$get({ query: { format: "native" } })).status).toBe(200);
    } finally {
      cleanup();
      queries.clear();
      runtime.close();
      await store.close();
    }
  },
);
