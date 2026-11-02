import { type AgentRuntime, newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import {
  agentCapabilitiesSchema,
  exportDocumentSchema,
  timestampSchema,
  type Uuid,
} from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createApi } from "../api.js";

const store = openLocalStore();
let owner: Uuid;
beforeAll(async () => await store.migrate(), 60000);
afterAll(async () => await store.close());
beforeEach(async () => {
  owner = newUuid();
  await store.createOwner(owner);
});
function app(agent?: AgentRuntime) {
  return createApi({
    unitOfWork: store.unitOfWork,
    runAsOwner,
    authenticate: () => Promise.resolve(owner),
    ...(agent === undefined ? {} : { agent }),
    agentLimits: {
      maxFileBytes: 20,
      maxTextFileBytes: 12,
      maxTurnBytes: 16,
      maxAttachments: 2,
      maxTextCharacters: 10,
    },
    agentScope: (_request, id) => Promise.resolve(`trusted:${id}`),
  });
}
const turnBody = () => ({
  id: newUuid(),
  text: "Hello",
  attachmentIds: [],
  context: { path: "/" },
  disclosure: true,
});
const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

it("advertises enforced limits without removing providerless creation, attachments or exports", async () => {
  const api = app();
  const id = newUuid();
  const file = newUuid();
  const capabilities = agentCapabilitiesSchema.parse(
    await (await api.request("/v1/agent/capabilities")).json(),
  );
  expect(capabilities).toMatchObject({
    available: false,
    historyAvailable: true,
    maxFileBytes: 20,
    maxTextFileBytes: 12,
    maxTurnBytes: 16,
    maxAttachments: 2,
    maxTextCharacters: 10,
  });
  expect(
    (await api.request("/v1/agent/conversations", json({ id, title: "History" }))).status,
  ).toBe(201);
  const upload = (text: string) => {
    const form = new FormData();
    form.set("file", new File([text], "notes.txt"));
    return api.request(`/v1/agent/conversations/${id}/attachments/${file}`, {
      method: "POST",
      body: form,
    });
  };
  expect((await upload("x".repeat(21))).status).toBe(413);
  expect((await upload("x".repeat(13))).status).toBe(422);
  expect((await upload("Original")).status).toBe(201);
  expect(
    await (await api.request(`/v1/agent/conversations/${id}/attachments/${file}`)).text(),
  ).toBe("Original");
  expect((await api.request(`/v1/agent/conversations/${id}/turns`, json(turnBody()))).status).toBe(
    503,
  );
  const archive = exportDocumentSchema.parse(
    await (await api.request("/v1/export?format=native")).json(),
  );
  expect(archive.store.agentHistory[0]?.id).toBe(id);
  expect(archive.store.agentAttachments[0]?.data).toBe("T3JpZ2luYWw=");
});

it("checks the lower runtime and API limits before work and passes only trusted scope", async () => {
  const turn = vi.fn<AgentRuntime["turn"]>(() => Promise.resolve());
  const grant = vi.fn<AgentRuntime["grant"]>();
  const runtime: AgentRuntime = {
    capabilities: { available: true, disclosure: "Synthetic", maxFileBytes: 18, maxAttachments: 1 },
    turn,
    grant,
    decide: () => Promise.reject(new Error("Unused")),
    cancel: () => {},
    close: () => {},
  };
  const api = app(runtime);
  const id = newUuid();
  await api.request("/v1/agent/conversations", json({ id, title: "Task" }));
  expect(await (await api.request("/v1/agent/capabilities")).json()).toMatchObject({
    maxFileBytes: 18,
    maxAttachments: 1,
    maxTextCharacters: 10,
  });
  expect(
    (
      await api.request(
        `/v1/agent/conversations/${id}/turns`,
        json({ ...turnBody(), text: "x".repeat(11) }),
      )
    ).status,
  ).toBe(413);
  expect(
    (
      await api.request(
        `/v1/agent/conversations/${id}/turns`,
        json({ ...turnBody(), attachmentIds: [newUuid(), newUuid()] }),
      )
    ).status,
  ).toBe(413);
  expect(turn).not.toHaveBeenCalled();
  const response = await api.request(`/v1/agent/conversations/${id}/turns`, json(turnBody()));
  await response.text();
  expect(turn).toHaveBeenCalledOnce();
  expect(turn.mock.calls[0]?.[5]).toBe(`trusted:${owner}`);
  await api.request(`/v1/agent/conversations/${id}/grant`, {
    ...json({ grant: null }),
    method: "PUT",
  });
  expect(grant.mock.calls[0]?.[3]).toBe(`trusted:${owner}`);
});

it.each([true, false, undefined])(
  "reports unconfirmed Stop against an unexpired lease: %s",
  async (local) => {
    const id = newUuid();
    const leaseUntil = new Date(Date.now() + 60000).toISOString();
    const before = await runAsOwner(owner, () =>
      store.unitOfWork.run(async (r) => {
        const conversation = await r.agent.create(id, "Running");
        conversation.run = {
          id: newUuid(),
          state: "running",
          context: { path: "/" },
          error: null,
          leaseUntil: timestampSchema.parse(leaseUntil),
        };
        return await r.agent.save(conversation);
      }),
    );
    const cancel = vi.fn<AgentRuntime["cancel"]>(() => local);
    const runtime: AgentRuntime = {
      capabilities: { available: true, disclosure: "Synthetic", maxFileBytes: 20 },
      turn: () => Promise.resolve(),
      grant: () => {},
      decide: () => Promise.reject(new Error("Unused")),
      cancel,
      close: () => {},
    };
    const response = await app(runtime).request(`/v1/agent/conversations/${id}/cancel`, {
      method: "POST",
    });
    expect(response.status).toBe(local === true ? 200 : 409);
    if (local !== true)
      expect(await response.json()).toMatchObject({
        status: 409,
        detail:
          "No local task was confirmed stopped. Its running lease remains; wait for lease expiry or stop it in the process executing the task. Local task access was cleared.",
      });
    expect(cancel).toHaveBeenCalledWith(owner, id);
    expect(await runAsOwner(owner, () => store.unitOfWork.run((r) => r.agent.get(id)))).toEqual(
      before,
    );
  },
);

it("accepts Stop after lease expiry and checks ownership before invoking cancellation", async () => {
  const id = newUuid();
  await runAsOwner(owner, () =>
    store.unitOfWork.run(async (r) => {
      const conversation = await r.agent.create(id, "Expired");
      conversation.run = {
        id: newUuid(),
        state: "running",
        context: { path: "/" },
        error: null,
        leaseUntil: conversation.createdAt,
      };
      await r.agent.save(conversation);
    }),
  );
  const cancel = vi.fn<AgentRuntime["cancel"]>(() => false);
  const runtime: AgentRuntime = {
    capabilities: { available: true, disclosure: "Synthetic", maxFileBytes: 20 },
    turn: () => Promise.resolve(),
    grant: () => {},
    decide: () => Promise.reject(new Error("Unused")),
    cancel,
    close: () => {},
  };
  expect(
    (await app(runtime).request(`/v1/agent/conversations/${id}/cancel`, { method: "POST" })).status,
  ).toBe(200);
  owner = newUuid();
  await store.createOwner(owner);
  expect(
    (await app(runtime).request(`/v1/agent/conversations/${id}/cancel`, { method: "POST" })).status,
  ).toBe(404);
  expect(cancel).toHaveBeenCalledOnce();
});
