import { type AgentModel, createAgent, type ModelReply } from "@keepcv/agent";
import { createApi, SESSION_TOKEN_HEADER, sessionTokenAuth } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { timestampSchema } from "@keepcv/schema";
import { expect, it, vi } from "vitest";

it("keeps Stop, lease recovery and durable receipts consistent through installed entry points", async () => {
  const store = openLocalStore();
  const runtimes: ReturnType<typeof createAgent>[] = [];
  const answer: ModelReply = { text: "Review", sources: [], navigation: null };
  let ready = () => {};
  let release: (reply: ModelReply) => void = () => {};
  const entered = new Promise<void>((resolve) => {
    ready = resolve;
  });
  let streaming: Promise<string> | undefined;
  let now = Date.now();
  vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    await store.migrate();
    const owner = await store.ensureLocalOwner();
    const id = newUuid();
    const read = () => runAsOwner(owner, () => store.unitOfWork.run((r) => r.agent.get(id)));
    const row = await runAsOwner(owner, () =>
      store.unitOfWork.run(async (r) => {
        await r.agent.create(id, "Recovery");
        return await r.organisations.create({
          id: newUuid(),
          name: "Before",
          kind: "company",
          website: null,
          industry: null,
          location: null,
        });
      }),
    );
    const makeRuntime = (model: AgentModel) => {
      const runtime = createAgent({ unitOfWork: store.unitOfWork, model, disclosure: "Synthetic" });
      runtimes.push(runtime);
      return runtime;
    };
    const apiFor = (agent: ReturnType<typeof createAgent>) =>
      createApi({
        unitOfWork: store.unitOfWork,
        runAsOwner,
        authenticate: sessionTokenAuth("synthetic", owner),
        agent,
      });
    const request = (body?: unknown): RequestInit => ({
      method: "POST",
      headers: { [SESSION_TOKEN_HEADER]: "synthetic", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const turn = () =>
      request({
        id: newUuid(),
        text: "Review",
        attachmentIds: [],
        context: { path: "/" },
        disclosure: true,
      });
    const active = makeRuntime({
      generate: async (task) => {
        await task.propose("Rename", [
          {
            type: "organisations.update",
            id: row.id,
            expectedUpdatedAt: row.updatedAt,
            patch: { name: "Committed" },
          },
        ]);
        ready();
        return await new Promise<ModelReply>((resolve) => {
          release = resolve;
        });
      },
    });
    active.grant(owner, id, {
      resources: ["organisations", row.id],
      expiresInSeconds: 600,
      writes: 2,
    });
    const first = apiFor(active);
    const response = await first.request(`/v1/agent/conversations/${id}/turns`, turn());
    streaming = response.text();
    await Promise.race([
      entered,
      streaming.then((text) => {
        throw new Error(`The model finished before its waiting step: ${text}`);
      }),
    ]);
    const before = await read();
    const applied = before.actions[0];
    if (applied === undefined) throw new Error("No committed receipt");
    expect(applied.status).toBe("applied");
    const generate = vi.fn<AgentModel["generate"]>().mockResolvedValue(answer);
    const recreated = makeRuntime({ generate });
    recreated.grant(owner, id, {
      resources: ["organisations", row.id],
      expiresInSeconds: 600,
      writes: 1,
    });
    const second = apiFor(recreated);
    const refused = await second.request(`/v1/agent/conversations/${id}/cancel`, request());
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({
      detail:
        "No local task was confirmed stopped. Its running lease remains; wait for lease expiry or stop it in the process executing the task. Local task access was cleared.",
    });
    expect(await read()).toEqual(before);
    expect(
      await (await second.request(`/v1/agent/conversations/${id}/turns`, turn())).text(),
    ).toContain("running lease");
    expect(generate).not.toHaveBeenCalled();
    expect((await first.request(`/v1/agent/conversations/${id}/cancel`, request())).status).toBe(
      200,
    );
    await streaming;
    expect((await read()).run?.state).toBe("cancelled");
    expect((await read()).actions[0]).toEqual(applied);
    const saved = await runAsOwner(owner, () =>
      store.unitOfWork.run((r) => r.organisations.get(row.id)),
    );
    generate.mockImplementation(async (task) => {
      await task.propose("Fresh rename", [
        {
          type: "organisations.update",
          id: saved.id,
          expectedUpdatedAt: saved.updatedAt,
          patch: { name: "Needs review" },
        },
      ]);
      return answer;
    });
    await (await second.request(`/v1/agent/conversations/${id}/turns`, turn())).text();
    const pending = (await read()).actions[1];
    if (pending === undefined) throw new Error("No pending review");
    expect(pending).toMatchObject({ status: "pending", receipt: null });
    recreated.close();
    await runAsOwner(owner, () =>
      store.unitOfWork.run(async (r) => {
        const current = await r.agent.get(id);
        if (current.run === null) throw new Error("No historical run");
        current.run.state = "running";
        current.run.leaseUntil = timestampSchema.parse(new Date(now + 60000).toISOString());
        await r.agent.save(current);
      }),
    );
    const third = apiFor(makeRuntime({ generate }));
    expect((await third.request(`/v1/agent/conversations/${id}/cancel`, request())).status).toBe(
      409,
    );
    expect(
      (
        await third.request(
          `/v1/agent/conversations/${id}/actions/${pending.id}`,
          request({ accept: true }),
        )
      ).status,
    ).toBe(409);
    now += 60000;
    expect((await third.request(`/v1/agent/conversations/${id}/cancel`, request())).status).toBe(
      200,
    );
    await (await third.request(`/v1/agent/conversations/${id}/turns`, turn())).text();
    expect((await read()).actions[0]).toEqual(applied);
    expect((await read()).actions[1]).toEqual(pending);
    expect(
      (
        await third.request(
          `/v1/agent/conversations/${id}/actions/${applied.id}`,
          request({ accept: true }),
        )
      ).status,
    ).toBe(200);
    expect(
      await runAsOwner(owner, () => store.unitOfWork.run((r) => r.organisations.get(row.id))),
    ).toEqual(saved);
  } finally {
    for (const runtime of runtimes) runtime.close();
    release(answer);
    await streaming?.catch(() => undefined);
    vi.restoreAllMocks();
    await store.close();
  }
});
