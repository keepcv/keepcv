import { newUuid } from "@keepcv/core";
import { agentConversationSchema } from "@keepcv/schema";
import { expect, it } from "vitest";
import { SESSION_TOKEN, withApi } from "../api.harness.js";
import { SESSION_TOKEN_HEADER } from "../auth.js";

const { send, raw, otherOwner } = withApi();
it("keeps ordinary store access available when no model is configured", async () => {
  expect(await (await send("GET", "/v1/agent/capabilities")).json()).toMatchObject({
    available: false,
  });
  expect((await send("GET", "/v1/store")).status).toBe(200);
});

it("retains original upload bytes and refuses changed retries and cross-owner downloads", async () => {
  const id = newUuid();
  const fileId = newUuid();
  await send("POST", "/v1/agent/conversations", { id, title: "File task" });
  async function upload(text: string) {
    const form = new FormData();
    form.set("file", new File([text], "notes.txt", { type: "text/plain" }));
    return await raw(`/v1/agent/conversations/${id}/attachments/${fileId}`, {
      method: "POST",
      headers: { [SESSION_TOKEN_HEADER]: SESSION_TOKEN },
      body: form,
    });
  }
  expect((await upload("ASCII career notes")).status).toBe(201);
  expect((await upload("ASCII career notes")).status).toBe(201);
  expect((await upload("Different notes")).status).toBe(409);
  const original = await send("GET", `/v1/agent/conversations/${id}/attachments/${fileId}`);
  expect(await original.text()).toBe("ASCII career notes");
  expect(original.headers.get("content-disposition")).toContain("attachment");
  const other = await otherOwner();
  expect((await other("GET", `/v1/agent/conversations/${id}/attachments/${fileId}`)).status).toBe(
    404,
  );
});
it("declares and owns conversations without exposing caller-selected models", async () => {
  const id = newUuid();
  const created = await send("POST", "/v1/agent/conversations", { id, title: "Career task" });
  expect(created.status).toBe(201);
  expect(agentConversationSchema.parse(await created.json()).id).toBe(id);
  const other = await otherOwner();
  expect((await other("GET", `/v1/agent/conversations/${id}`)).status).toBe(404);
  expect(
    (
      await send("POST", `/v1/agent/conversations/${id}/turns`, {
        id: newUuid(),
        text: "Hello",
        attachmentIds: [],
        context: { path: "/" },
        disclosure: true,
        model: "unauthorized",
      })
    ).status,
  ).toBe(422);
});
