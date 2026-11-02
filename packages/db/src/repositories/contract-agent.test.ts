import { NotFoundError, newUuid } from "@keepcv/core";
import { expect, it } from "vitest";
import { eachDriver } from "./contract.harness.js";

eachDriver(({ run, otherOwner }) => {
  it("scopes conversation locks, attachments and metadata to the current owner", async () => {
    const chat = await run(async (r) => await r.agent.create(newUuid(), "Mine"));
    await run(
      async (r) =>
        await r.agent.attach({
          id: newUuid(),
          conversationId: chat.id,
          name: "private.txt",
          mediaType: "text/plain",
          data: "cHJpdmF0ZQ==",
        }),
    );
    const other = await otherOwner();
    expect(await other(async (r) => await r.agent.list(true))).toEqual([]);
    expect(await other(async (r) => await r.agent.attachments(chat.id))).toEqual([]);
    await expect(other(async (r) => await r.agent.get(chat.id, true))).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
  it("preserves messages against rewriting and restores original bytes in a native backup", async () => {
    const chat = await run(async (r) => await r.agent.create(newUuid(), "Keep this"));
    chat.messages.push({
      id: newUuid(),
      role: "user",
      text: "My notes",
      attachmentIds: [],
      sources: [],
      createdAt: chat.createdAt,
      state: "complete",
      navigation: null,
    });
    const saved = await run(async (r) => await r.agent.save(chat));
    const first = saved.messages[0];
    if (first === undefined) throw new Error("Missing message");
    first.text = "Changed";
    await expect(run(async (r) => await r.agent.save(saved))).rejects.toThrow(
      "cannot be rewritten",
    );
    await run(
      async (r) =>
        await r.agent.attach({
          id: newUuid(),
          conversationId: chat.id,
          name: "notes.txt",
          mediaType: "text/plain",
          data: "AAECA//+",
        }),
    );
    const archive = await run(async (r) => await r.store.read());
    const other = await otherOwner();
    await other(async (r) => await r.store.load(archive));
    expect(await other(async (r) => await r.store.read())).toEqual(archive);
    expect(await run(async (r) => await r.store.readCurrent())).not.toHaveProperty("agentHistory");
  });
});
