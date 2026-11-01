import { type AgentEvent, AgentRefusalError, newUuid, type Repositories } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { type AgentOperation, timestampSchema, type Uuid } from "@keepcv/schema";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { type AgentModel, createAgent, type ModelReply, type ModelRequest } from "./runtime.js";

const store = openLocalStore();
let owner: Uuid;
let conversation: Uuid;
let runtime: ReturnType<typeof createAgent>;
let now: number;
const generate = vi.fn<AgentModel["generate"]>();
const answer: ModelReply = { text: "Review", sources: [], navigation: null };
const run = <T>(work: (r: Repositories) => Promise<T>, id = owner) =>
  runAsOwner(id, () => store.unitOfWork.run(work));
const freshRuntime = () =>
  createAgent({ unitOfWork: store.unitOfWork, model: { generate }, disclosure: "Synthetic" });
beforeAll(async () => await store.migrate(), 60000);
afterAll(async () => await store.close());
beforeEach(async () => {
  now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  owner = newUuid();
  conversation = newUuid();
  await store.createOwner(owner);
  await run((r) => r.agent.create(conversation, "Lifecycle"));
  generate.mockReset();
  generate.mockResolvedValue(answer);
  runtime = freshRuntime();
});
afterEach(() => {
  runtime.close();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function turn(id = conversation, ownerId = owner, scope = "origin") {
  const events: AgentEvent[] = [];
  await runAsOwner(ownerId, () =>
    runtime.turn(
      ownerId,
      id,
      {
        id: newUuid(),
        text: "Review career data",
        attachmentIds: [],
        disclosure: true,
        context: { path: "/profile" },
      },
      (event) => {
        events.push(event);
        return Promise.resolve();
      },
      new AbortController().signal,
      scope,
    ),
  );
  return events;
}
const decide = (id: Uuid, accept = true, ownerId = owner) =>
  runAsOwner(ownerId, () => runtime.decide(ownerId, conversation, id, accept, "origin"));
async function change(headline: string): Promise<AgentOperation> {
  const profile = await run((r) => r.profile.get());
  return { type: "profile.update", expectedUpdatedAt: profile.updatedAt, patch: { headline } };
}
function suggest(operation: AgentOperation) {
  generate.mockImplementation(async (request) => {
    await request.propose("Change", [operation]);
    return answer;
  });
}

it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 180001])(
  "refuses an unsafe lease deadline before creating a runtime: %s",
  (deadlineMs) => {
    expect(() =>
      createAgent({
        unitOfWork: store.unitOfWork,
        model: { generate },
        disclosure: "Synthetic",
        deadlineMs,
      }),
    ).toThrowError(ZodError);
    expect(generate).not.toHaveBeenCalled();
  },
);

it("reclaims every committed acceptance/rejection and replays receipts without admission", async () => {
  for (let index = 0; index < 130; index++) {
    suggest(await change(`Headline ${index}`));
    expect(await turn()).not.toContainEqual(expect.objectContaining({ type: "error" }));
    const action = (await run((r) => r.agent.get(conversation))).actions.at(-1);
    if (action === undefined) throw new Error("No proposal");
    const result = await decide(action.id, index % 2 === 0);
    expect(result.actions.at(-1)?.status).toBe(index % 2 === 0 ? "applied" : "rejected");
    const profile = await run((r) => r.profile.get());
    expect((await decide(action.id)).actions).toEqual(result.actions);
    expect(await run((r) => r.profile.get())).toEqual(profile);
  }
  const actions = (await run((r) => r.agent.get(conversation))).actions;
  const results: string[] = [];
  generate.mockImplementation(async (request) => {
    for (const action of actions)
      results.push(await request.propose(action.summary, action.operations));
    return answer;
  });
  expect(await turn()).toContainEqual({ type: "done", text: "Saved" });
  expect(results).toHaveLength(130);
}, 60000);

it("bounds pending admissions and requires a fresh authorized review after idle expiry", async () => {
  runtime.close();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let refuseReview = false;
  const authorize = vi.fn((context: { phase: string }) =>
    context.phase === "propose" && refuseReview
      ? Promise.reject(new Error("Review refused"))
      : Promise.resolve(),
  );
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate },
    disclosure: "Synthetic",
    authorize,
  });
  let captured: ModelRequest | undefined;
  const operation = await change("First");
  generate.mockImplementation(async (request) => {
    captured = request;
    for (let index = 0; index < 128; index++)
      await request.propose("Pending", [{ ...operation, patch: { headline: `Pending ${index}` } }]);
    return answer;
  });
  expect(await turn()).not.toContainEqual(expect.objectContaining({ type: "error" }));
  suggest(await change("Overflow"));
  expect(await turn()).toContainEqual({
    type: "error",
    text: "Too many proposals awaiting review. Decide a proposal or wait for its review window to expire, then request fresh review.",
  });
  const pending = (await run((r) => r.agent.get(conversation))).actions[0];
  if (pending === undefined) throw new Error("No proposal");
  now += 30 * 60 * 1000;
  await vi.advanceTimersByTimeAsync(60000);
  expect(captured?.signal.aborted).toBe(true);
  await expect(decide(pending.id)).rejects.toMatchObject({
    name: "AgentRefusalError",
    status: 409,
  });
  expect((await run((r) => r.profile.get())).headline).toBeNull();
  suggest(pending.operations[0] ?? operation);
  refuseReview = true;
  await turn();
  await expect(decide(pending.id)).rejects.toMatchObject({ status: 409 });
  refuseReview = false;
  authorize.mockClear();
  expect(await turn()).not.toContainEqual(expect.objectContaining({ type: "error" }));
  expect(authorize.mock.calls.some(([context]) => context.phase === "propose")).toBe(true);
  expect((await decide(pending.id)).actions[0]?.status).toBe("applied");
}, 60000);

it("prunes expired grants on the idle sweep and cannot use their former authority", async () => {
  runtime.close();
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  runtime = freshRuntime();
  const row = await run((r) =>
    r.organisations.create({
      id: newUuid(),
      name: "Before",
      kind: "company",
      website: null,
      industry: null,
      location: null,
    }),
  );
  runtime.grant(
    owner,
    conversation,
    { resources: ["organisations", row.id], expiresInSeconds: 1, writes: 1 },
    "origin",
  );
  for (let index = 1; index < 128; index++)
    runtime.grant(
      owner,
      newUuid(),
      { resources: ["profile"], expiresInSeconds: 1, writes: 1 },
      "origin",
    );
  expect(() =>
    runtime.grant(
      owner,
      newUuid(),
      { resources: ["profile"], expiresInSeconds: 1, writes: 1 },
      "origin",
    ),
  ).toThrowError("Too many temporary grants. Revoke a grant or wait for expiry.");
  now += 1000;
  await vi.advanceTimersByTimeAsync(60000);
  for (let index = 0; index < 128; index++)
    runtime.grant(
      owner,
      newUuid(),
      { resources: ["profile"], expiresInSeconds: 600, writes: 1 },
      "origin",
    );
  suggest({
    type: "organisations.update",
    id: row.id,
    expectedUpdatedAt: row.updatedAt,
    patch: { name: "After" },
  });
  await turn();
  expect((await run((r) => r.organisations.get(row.id))).name).toBe("Before");
  expect((await run((r) => r.agent.get(conversation))).actions[0]).toMatchObject({
    status: "pending",
    receipt: null,
  });
});

it("reclaims exhausted grants after the last automatic write commits", async () => {
  const row = await run((r) =>
    r.organisations.create({
      id: newUuid(),
      name: "Before",
      kind: "company",
      website: null,
      industry: null,
      location: null,
    }),
  );
  runtime.grant(
    owner,
    conversation,
    { resources: ["organisations", row.id], expiresInSeconds: 600, writes: 1 },
    "origin",
  );
  suggest({
    type: "organisations.update",
    id: row.id,
    expectedUpdatedAt: row.updatedAt,
    patch: { name: "After" },
  });
  await turn();
  expect((await run((r) => r.organisations.get(row.id))).name).toBe("After");
  expect((await run((r) => r.agent.get(conversation))).actions[0]?.status).toBe("applied");
  for (let index = 0; index < 128; index++)
    runtime.grant(
      owner,
      newUuid(),
      { resources: ["profile"], expiresInSeconds: 600, writes: 1 },
      "origin",
    );
});

it.each([true, false])(
  "forgets cached terminal proposals when another runtime decides: %s",
  async (accept) => {
    const operation = await change("Original");
    suggest(operation);
    await turn();
    const action = (await run((r) => r.agent.get(conversation))).actions[0];
    if (action === undefined) throw new Error("No proposal");
    const first = runtime;
    runtime = freshRuntime();
    try {
      await turn();
      await runAsOwner(owner, () => first.decide(owner, conversation, action.id, accept, "origin"));
      expect(await turn()).toContainEqual({ type: "done", text: "Saved" });
      const profile = await run((r) => r.profile.get());
      generate.mockImplementation(async (request) => {
        for (let index = 0; index < 128; index++)
          await request.propose("Pending", [
            {
              type: "profile.update",
              expectedUpdatedAt: profile.updatedAt,
              patch: { headline: `Pending ${index}` },
            },
          ]);
        return answer;
      });
      expect(await turn()).toContainEqual({ type: "done", text: "Saved" });
      expect((await run((r) => r.agent.get(conversation))).actions[0]?.status).toBe(
        accept ? "applied" : "rejected",
      );
    } finally {
      first.close();
    }
  },
  30000,
);

it("never forgets a revoked scope during cleanup and retires rather than evicting revocations", async () => {
  runtime.revoke(owner, "origin");
  now += 31 * 60 * 1000;
  runtime.cancel(owner, conversation);
  expect(() =>
    runtime.grant(
      owner,
      conversation,
      { resources: ["profile"], expiresInSeconds: 1, writes: 1 },
      "origin",
    ),
  ).toThrowError(AgentRefusalError);
  expect(await turn()).toContainEqual({ type: "error", text: "Task authority was revoked." });
  expect(generate).not.toHaveBeenCalled();
  for (let index = 1; index < 128; index++) runtime.revoke(owner, `scope-${index}`);
  runtime.revoke(owner, "origin");
  expect(runtime.capabilities.available).toBe(true);
  runtime.revoke(owner, "overflow");
  expect(runtime.capabilities.available).toBe(false);
  await expect(turn()).rejects.toMatchObject({ name: "AgentRefusalError", status: 503 });
  await expect(turn(conversation, owner, "fresh")).rejects.toMatchObject({
    name: "AgentRefusalError",
    status: 503,
  });
  expect(generate).not.toHaveBeenCalled();
  runtime.close();
  expect(() =>
    runtime.grant(
      owner,
      conversation,
      { resources: ["profile"], expiresInSeconds: 1, writes: 1 },
      "fresh",
    ),
  ).toThrowError(AgentRefusalError);
});

it("keeps imported owner admissions separate during cancellation and revocation cleanup", async () => {
  const operation = await change("Other owner");
  suggest(operation);
  await turn();
  const archive = await run((r) => r.store.read());
  const other = newUuid();
  await store.createOwner(other);
  await run((r) => r.store.load(archive), other);
  const action = archive.agentHistory[0]?.actions[0];
  if (action === undefined) throw new Error("No proposal");
  await expect(decide(action.id, true, other)).rejects.toMatchObject({ status: 409 });
  await turn(conversation, other);
  runtime.cancel(owner, conversation);
  runtime.revoke(owner, "origin");
  expect((await decide(action.id, true, other)).actions[0]?.status).toBe("applied");
  expect((await run((r) => r.profile.get(), other)).headline).toBe("Other owner");
  expect((await run((r) => r.profile.get())).headline).toBeNull();
});

it("leaves a recreated runtime's running lease intact and recovers only after expiry", async () => {
  const before = await run(async (r) => {
    const current = await r.agent.get(conversation);
    current.run = {
      id: newUuid(),
      state: "running",
      context: { path: "/" },
      error: null,
      leaseUntil: timestampSchema.parse(new Date(now + 60000).toISOString()),
    };
    return await r.agent.save(current);
  });
  runtime.close();
  runtime = freshRuntime();
  expect(runtime.cancel(owner, conversation)).toBe(false);
  expect(await run((r) => r.agent.get(conversation))).toEqual(before);
  expect(await turn()).toContainEqual({
    type: "error",
    text: "This conversation has a running lease. Stop it in the process executing the task or wait for lease expiry.",
  });
  expect(generate).not.toHaveBeenCalled();
  now += 60000;
  expect(runtime.cancel(owner, conversation)).toBe(false);
  expect(await turn()).toContainEqual({ type: "done", text: "Saved" });
  expect(generate).toHaveBeenCalledOnce();
});

it("rolls back content and the receipt when review authority expires between operations", async () => {
  runtime.close();
  let applying = 0;
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate },
    disclosure: "Synthetic",
    authorize: (context) => {
      if (context.phase === "apply" && ++applying === 3) now += 30 * 60 * 1000;
      return Promise.resolve();
    },
  });
  generate.mockImplementation(async (request) => {
    await request.propose(
      "Group",
      ["First", "Second"].map((name) => ({
        type: "organisations.create",
        input: {
          id: newUuid(),
          name,
          kind: "company",
          website: null,
          industry: null,
          location: null,
        },
      })),
    );
    return answer;
  });
  await turn();
  const action = (await run((r) => r.agent.get(conversation))).actions[0];
  if (action === undefined) throw new Error("No proposal");
  await expect(decide(action.id)).rejects.toMatchObject({ name: "AgentRefusalError", status: 409 });
  expect(await run((r) => r.organisations.list({ includeArchived: true }))).toEqual([]);
  expect((await run((r) => r.agent.get(conversation))).actions[0]).toMatchObject({
    status: "pending",
    receipt: null,
  });
});

it("retires active work at revocation capacity and refuses its late callbacks", async () => {
  let ready = () => {};
  let release: (reply: ModelReply) => void = () => {};
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let captured: ModelRequest | undefined;
  generate.mockImplementation((request) => {
    captured = request;
    ready();
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  const running = turn();
  await entered;
  for (let index = 0; index < 129; index++) runtime.revoke(owner, `unrelated-${index}`);
  await running;
  expect(runtime.capabilities.available).toBe(false);
  expect(captured?.signal.aborted).toBe(true);
  if (captured === undefined) throw new Error("No model request");
  await expect(captured.read("profile", "")).rejects.toMatchObject({
    name: "AgentRefusalError",
    status: 503,
  });
  expect((await run((r) => r.agent.get(conversation))).run?.state).toBe("cancelled");
  expect((await run((r) => r.profile.get())).headline).toBeNull();
  release(answer);
});

it("cannot cancel another runtime's live execution and preserves its committed receipt", async () => {
  const row = await run((r) =>
    r.organisations.create({
      id: newUuid(),
      name: "Before",
      kind: "company",
      website: null,
      industry: null,
      location: null,
    }),
  );
  runtime.grant(
    owner,
    conversation,
    { resources: ["organisations", row.id], expiresInSeconds: 600, writes: 2 },
    "origin",
  );
  let ready = () => {};
  let release: (answer: ModelReply) => void = () => {};
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let request: ModelRequest | undefined;
  generate.mockImplementation(async (value) => {
    request = value;
    await value.propose("Rename", [
      {
        type: "organisations.update",
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
        patch: { name: "After" },
      },
    ]);
    await value.propose("Pending", [await change("Pending")]);
    ready();
    return await new Promise<ModelReply>((resolve) => {
      release = resolve;
    });
  });
  const running = turn();
  await entered;
  const other = freshRuntime();
  try {
    expect(other.cancel(owner, conversation)).toBe(false);
    expect(request?.signal.aborted).toBe(false);
    const before = await run((r) => r.agent.get(conversation));
    expect(before.run?.state).toBe("running");
    expect(before.actions[0]?.status).toBe("applied");
    const pending = before.actions[1];
    if (pending === undefined) throw new Error("No pending proposal");
    expect(runtime.cancel(owner, conversation)).toBe(true);
    await running;
    const stopped = await run((r) => r.agent.get(conversation));
    expect(stopped.run?.state).toBe("cancelled");
    expect(stopped.actions[0]).toEqual(before.actions[0]);
    expect((await run((r) => r.organisations.get(row.id))).name).toBe("After");
    await expect(decide(pending.id)).rejects.toMatchObject({ status: 409 });
    suggest(await change("Fresh"));
    await turn();
    expect((await run((r) => r.agent.get(conversation))).actions.at(-1)?.status).toBe("pending");
  } finally {
    other.close();
    release(answer);
  }
});
