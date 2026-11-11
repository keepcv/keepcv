import { AgentRefusalError, newUuid, type Repositories } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import type { Uuid } from "@keepcv/schema";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  type AgentAuthorization,
  type AgentModel,
  createAgent,
  type ModelReply,
  type ModelRequest,
} from "./runtime.js";

const store = openLocalStore();
let owner: Uuid;
let conversation: Uuid;
let runtime: ReturnType<typeof createAgent>;
let policy: (context: AgentAuthorization) => Promise<void>;
const generate = vi.fn<AgentModel["generate"]>();
const run = async <T>(work: (r: Repositories) => Promise<T>, id = owner) =>
  await runAsOwner(id, () => store.unitOfWork.run(work));
beforeAll(async () => await store.migrate(), 60000);
afterAll(async () => await store.close());
afterEach(() => runtime.close());
beforeEach(async () => {
  owner = newUuid();
  conversation = newUuid();
  await store.createOwner(owner);
  await run((r) => r.agent.create(conversation, "Scoped task"));
  generate.mockReset();
  policy = () => Promise.resolve();
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate },
    disclosure: "Synthetic",
    authorize: (context) => policy(context),
  });
});
async function turn(scope = "session", id = owner) {
  await runAsOwner(id, () =>
    runtime.turn(
      id,
      conversation,
      {
        id: newUuid(),
        text: "Update career data",
        attachmentIds: [],
        disclosure: true,
        context: { path: "/profile" },
      },
      () => Promise.resolve(),
      new AbortController().signal,
      scope,
    ),
  );
}
async function proposeProfile(request: ModelRequest) {
  const profile = await run((r) => r.profile.get());
  await request.propose("Name", [
    { type: "profile.update", expectedUpdatedAt: profile.updatedAt, patch: { fullName: "Ada" } },
  ]);
  return { text: "Review", sources: [], navigation: null };
}

it("refuses authority before reading history or invoking a model", async () => {
  policy = (context) =>
    context.phase === "read"
      ? Promise.reject(new Error("Private policy detail"))
      : Promise.resolve();
  await turn();
  expect(generate).not.toHaveBeenCalled();
  expect((await run((r) => r.agent.get(conversation))).messages).toEqual([]);
});

it("cancels a waiting custom model and refuses its late reads and proposals", async () => {
  let release: (reply: ModelReply) => void = () => {};
  let entered: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let captured: ModelRequest | undefined;
  generate.mockImplementation((request) => {
    captured = request;
    entered();
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  const pending = turn();
  await ready;
  runtime.revoke(owner, "session");
  await pending;
  expect((await run((r) => r.agent.get(conversation))).run?.state).toBe("cancelled");
  if (captured === undefined) throw new Error("No model request");
  await expect(captured.read("profile", "")).rejects.toBeDefined();
  await expect(
    captured.propose("Late", [{ type: "profile.update", patch: { fullName: "Late" } }]),
  ).rejects.toBeDefined();
  release({ text: "Late", sources: [], navigation: null });
  expect((await run((r) => r.profile.get())).fullName).toBeNull();
});

it("revokes pending proposals and grants without authorizing another session", async () => {
  generate.mockImplementation(proposeProfile);
  runtime.grant(
    owner,
    conversation,
    { resources: ["profile"], expiresInSeconds: 600, writes: 1 },
    "session",
  );
  await turn();
  const action = (await run((r) => r.agent.get(conversation))).actions[0];
  if (action === undefined) throw new Error("No proposal");
  runtime.revoke(owner, "session");
  await expect(
    runAsOwner(owner, () => runtime.decide(owner, conversation, action.id, true, "session")),
  ).rejects.toBeInstanceOf(AgentRefusalError);
  await expect(
    runAsOwner(owner, () => runtime.decide(owner, conversation, action.id, true, "new-session")),
  ).rejects.toMatchObject({ status: 409 });
  expect((await run((r) => r.profile.get())).fullName).toBeNull();
});

it("revalidates immediately before an automatic write", async () => {
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
    "session",
  );
  policy = (context) => {
    if (context.phase === "apply") runtime.revoke(owner, "session");
    return Promise.resolve();
  };
  generate.mockImplementation(async (request) => {
    await request.propose("Rename", [
      {
        type: "organisations.update",
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
        patch: { name: "After" },
      },
    ]);
    return { text: "Applied", sources: [], navigation: null };
  });
  await turn();
  expect((await run((r) => r.organisations.get(row.id))).name).toBe("Before");
  expect((await run((r) => r.agent.get(conversation))).actions[0]).toMatchObject({
    status: "pending",
    receipt: null,
  });
});

it("rolls back the group and receipt when authority changes between writes", async () => {
  generate.mockImplementation(async (request) => {
    await request.propose(
      "Two organisations",
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
    return { text: "Review", sources: [], navigation: null };
  });
  await turn();
  const action = (await run((r) => r.agent.get(conversation))).actions[0];
  if (action === undefined) throw new Error("No proposal");
  let checks = 0;
  policy = (context) => {
    if (context.phase === "apply" && ++checks === 3) return Promise.reject(new Error("Revoked"));
    return Promise.resolve();
  };
  await expect(
    runAsOwner(owner, () => runtime.decide(owner, conversation, action.id, true, "session")),
  ).rejects.toMatchObject({ status: 403 });
  expect(await run((r) => r.organisations.list({ includeArchived: true }))).toEqual([]);
  expect((await run((r) => r.agent.get(conversation))).actions[0]).toMatchObject({
    status: "pending",
    receipt: null,
  });
});

it("imports identical IDs without importing authority or sharing revocation between owners", async () => {
  generate.mockImplementation(proposeProfile);
  await turn();
  const archive = await run((r) => r.store.read());
  const other = newUuid();
  await store.createOwner(other);
  await run((r) => r.store.load(archive), other);
  const action = archive.agentHistory[0]?.actions[0];
  if (action === undefined) throw new Error("No proposal");
  await expect(
    runAsOwner(other, () => runtime.decide(other, conversation, action.id, true, "session")),
  ).rejects.toMatchObject({ status: 409 });
  runtime.revoke(owner, "session");
  generate.mockImplementation(() =>
    Promise.resolve({ text: "Other owner's task", sources: [], navigation: null }),
  );
  await turn("session", other);
  expect((await run((r) => r.agent.get(conversation), other)).messages.at(-1)?.text).toBe(
    "Other owner's task",
  );
  expect((await run((r) => r.agent.get(conversation))).messages.at(-1)?.text).toBe("Review");
});

it("restores original files and history without restoring temporary grants", async () => {
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
  const file = await run((r) =>
    r.agent.attach({
      id: newUuid(),
      conversationId: conversation,
      name: "notes.txt",
      mediaType: "text/plain",
      data: "T3JpZ2luYWw=",
    }),
  );
  runtime.grant(
    owner,
    conversation,
    { resources: ["organisations", row.id], expiresInSeconds: 600, writes: 2 },
    "session",
  );
  const archive = await run((r) => r.store.read());
  const other = newUuid();
  await store.createOwner(other);
  await run((r) => r.store.load(archive), other);
  expect(await run((r) => r.agent.attachments(conversation), other)).toEqual([file]);
  runtime.close();
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate },
    disclosure: "Synthetic",
    authorize: (context) => policy(context),
  });
  generate.mockImplementation(async (request) => {
    expect(
      await request.propose("Rename", [
        {
          type: "organisations.update",
          id: row.id,
          expectedUpdatedAt: row.updatedAt,
          patch: { name: "After" },
        },
      ]),
    ).toContain("pending");
    return { text: "Review", sources: [], navigation: null };
  });
  await turn("session", other);
  expect((await run((r) => r.organisations.get(row.id), other)).name).toBe("Before");
  expect((await run((r) => r.agent.get(conversation), other)).actions[0]).toMatchObject({
    status: "pending",
    receipt: null,
  });
});

it("retains observed sources and tool activity when a turn is interrupted", async () => {
  generate.mockImplementation(async (request) => {
    await request.tool?.("web_fetch", "Read an approved public page");
    await request.source?.({
      title: "Requested page",
      url: "https://example.com/public",
      provenance: "requested-url",
      tool: "web_fetch",
    });
    throw new Error("Synthetic interruption");
  });
  await turn();
  const saved = (await run((r) => r.agent.get(conversation))).messages.at(-1);
  expect(saved).toMatchObject({
    state: "interrupted",
    sources: [{ url: "https://example.com/public", provenance: "requested-url" }],
    toolCalls: [{ name: "web_fetch" }],
  });
});

it("narrows qualified model formats and defaults legacy custom models to text only", () => {
  expect(runtime.capabilities.generationMediaTypes).toEqual(["text/plain"]);
  runtime.close();
  runtime = createAgent({
    unitOfWork: store.unitOfWork,
    model: { generate, generationMediaTypes: ["text/plain", "image/png"] },
    generationMediaTypes: ["text/plain", "application/pdf"],
    disclosure: "Synthetic",
  });
  expect(runtime.capabilities.generationMediaTypes).toEqual(["text/plain"]);
});
