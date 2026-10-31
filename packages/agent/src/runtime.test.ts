import {
  type AgentRuntime,
  ConcurrencyConflictError,
  newUuid,
  type Repositories,
} from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import type { Uuid } from "@keepcv/schema";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { type AgentModel, createAgent, readableStore } from "./runtime.js";

const store = openLocalStore();
let owner: Uuid;
let conversationId: Uuid;
let runtime: AgentRuntime;
const generate = vi.fn<AgentModel["generate"]>();
const run = async <T>(work: (r: Repositories) => Promise<T>) =>
  await runAsOwner(owner, async () => await store.unitOfWork.run(work));
beforeAll(async () => await store.migrate(), 60000);
afterAll(async () => await store.close());
beforeEach(async () => {
  owner = newUuid();
  await store.createOwner(owner);
  conversationId = newUuid();
  await run(async (r) => await r.agent.create(conversationId, "Career task"));
  generate.mockReset();
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate },
    disclosure: "Synthetic provider",
  });
});
const turn = async (id = newUuid()) =>
  await runAsOwner(
    owner,
    async () =>
      await runtime.turn(
        owner,
        conversationId,
        {
          id,
          text: "Update my profile",
          attachmentIds: [],
          context: { path: "/profile" },
          disclosure: true,
        },
        async () => {},
        new AbortController().signal,
      ),
  );

it("reviews edits and returns the same receipt without applying twice", async () => {
  const profile = await run(async (r) => await r.profile.get());
  generate.mockImplementation(async (request) => {
    await request.propose("Update your name", [
      { type: "profile.update", expectedUpdatedAt: profile.updatedAt, patch: { fullName: "Ada" } },
    ]);
    return { text: "Please review", sources: [], navigation: null };
  });
  await turn();
  expect((await run(async (r) => await r.profile.get())).fullName).toBeNull();
  const pending = await run(async (r) => await r.agent.get(conversationId));
  const action = pending.actions[0];
  expect(action).toBeDefined();
  if (action === undefined) throw new Error("Missing proposal");
  const first = await runAsOwner(
    owner,
    async () => await runtime.decide(owner, conversationId, action.id, true),
  );
  const token = (await run(async (r) => await r.profile.get())).updatedAt;
  const second = await runAsOwner(
    owner,
    async () => await runtime.decide(owner, conversationId, action.id, true),
  );
  expect(second.actions).toEqual(first.actions);
  expect((await run(async (r) => await r.profile.get())).updatedAt).toBe(token);
});

it("rolls a dependent group back on a stale write and retains the proposal", async () => {
  const profile = await run(async (r) => await r.profile.get());
  generate.mockImplementation(async (request) => {
    await request.propose("Two changes", [
      { type: "profile.update", expectedUpdatedAt: profile.updatedAt, patch: { fullName: "Ada" } },
      {
        type: "profile.update",
        expectedUpdatedAt: profile.updatedAt,
        patch: { headline: "Engineer" },
      },
    ]);
    return { text: "Review", sources: [], navigation: null };
  });
  await turn();
  const action = (await run(async (r) => await r.agent.get(conversationId))).actions[0];
  if (action === undefined) throw new Error("Missing proposal");
  await expect(
    runAsOwner(owner, async () => await runtime.decide(owner, conversationId, action.id, true)),
  ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  expect((await run(async (r) => await r.profile.get())).fullName).toBeNull();
  expect((await run(async (r) => await r.agent.get(conversationId))).actions[0]?.status).toBe(
    "pending",
  );
});

it("does not restart a retried turn or regain authority after restart", async () => {
  const profile = await run(async (r) => await r.profile.get());
  generate.mockImplementation(async (request) => {
    await request.propose("Name", [
      { type: "profile.update", expectedUpdatedAt: profile.updatedAt, patch: { fullName: "Ada" } },
    ]);
    return { text: "Review", sources: [], navigation: null };
  });
  const id = newUuid();
  await turn(id);
  await turn(id);
  expect(generate).toHaveBeenCalledTimes(1);
  const action = (await run(async (r) => await r.agent.get(conversationId))).actions[0];
  if (action === undefined) throw new Error("Missing proposal");
  runtime.close();
  generate.mockImplementation(() =>
    Promise.resolve({ text: "New task", sources: [], navigation: null }),
  );
  await turn();
  await expect(
    runAsOwner(owner, async () => await runtime.decide(owner, conversationId, action.id, true)),
  ).rejects.toThrow("Reopen this task");
});

it("limits task grants to the named resource and keeps archive behind review", async () => {
  const organisation = await run(
    async (r) =>
      await r.organisations.create({
        id: newUuid(),
        name: "Before",
        kind: "company",
        website: null,
        industry: null,
        location: null,
      }),
  );
  runtime.grant(owner, conversationId, {
    resources: ["organisations", organisation.id],
    expiresInSeconds: 600,
    writes: 2,
  });
  generate.mockImplementation(async (request) => {
    expect(
      await request.propose("Rename", [
        {
          type: "organisations.update",
          id: organisation.id,
          expectedUpdatedAt: organisation.updatedAt,
          patch: { name: "After" },
        },
      ]),
    ).toContain("Applied");
    const current = await run(async (r) => await r.organisations.get(organisation.id));
    expect(
      await request.propose("Archive", [
        {
          type: "organisations.archive",
          id: organisation.id,
          expectedUpdatedAt: current.updatedAt,
        },
      ]),
    ).toContain("pending");
    return { text: "Review archive", sources: [], navigation: null };
  });
  await turn();
  expect(await run(async (r) => await r.organisations.get(organisation.id))).toMatchObject({
    name: "After",
    archivedAt: null,
  });
  expect(
    (await run(async (r) => await r.agent.get(conversationId))).actions.map(
      (action) => action.status,
    ),
  ).toEqual(["applied", "pending"]);
});

it("retains partial authored replies and hides Evidence from model reads", async () => {
  generate.mockImplementation(async (request) => {
    await request.text("Partial answer");
    throw new Error("vendor down");
  });
  await turn();
  const chat = await run(async (r) => await r.agent.get(conversationId));
  expect(chat.messages.at(-1)).toMatchObject({ text: "Partial answer", state: "interrupted" });
  expect(chat.run?.state).toBe("failed");
  expect(readableStore(await run(async (r) => await r.store.readCurrent()))).not.toHaveProperty(
    "evidence",
  );
});

it("rejects tools outside the application resource vocabulary", async () => {
  generate.mockImplementation(async (request) => {
    await request.propose("Erase", [{ type: "owner.purge" }]);
    return { text: "Applied", sources: [], navigation: null };
  });
  await turn();
  expect((await run(async (r) => await r.agent.get(conversationId))).actions).toEqual([]);
});
