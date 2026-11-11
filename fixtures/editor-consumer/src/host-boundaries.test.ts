// @vitest-environment node
import { createAgent } from "@keepcv/agent";
import { createApi } from "@keepcv/api";
import { newUuid } from "@keepcv/core";
import { openLocalStore, openServerStore, runAsOwner } from "@keepcv/db";
import { expect, it, vi } from "vitest";

it.each(["local", "server"])(
  "preserves consent, detected formats and owned originals on %s PostgreSQL",
  async (driver) => {
    if (driver === "server" && !process.env["DATABASE_URL"]) return;
    const store =
      driver === "server"
        ? openServerStore({ connectionString: process.env["DATABASE_URL"] as string, max: 3 })
        : openLocalStore();
    const owner = newUuid();
    const other = newUuid();
    const id = newUuid();
    const fileId = newUuid();
    const generate = vi.fn(async () => ({
      text: "Synthetic answer",
      sources: [],
      navigation: null,
    }));
    const runtime = createAgent({
      unitOfWork: store.unitOfWork,
      model: { generationMediaTypes: ["text/plain", "image/png"], generate },
      disclosure: "Synthetic services",
    });
    const app = (identity = owner) =>
      createApi({
        unitOfWork: store.unitOfWork,
        runAsOwner,
        authenticate: async () => identity,
        agent: runtime,
        generationMediaTypes: ["text/plain"],
      });
    const json = (body: unknown) => ({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const input = () => ({
      id: newUuid(),
      text: "Read original",
      attachmentIds: [fileId],
      context: { path: "/" },
      disclosure: true,
    });
    try {
      await store.migrate();
      await store.provisionOwner(owner);
      await store.provisionOwner(other);
      const api = app();
      expect(await (await api.request("/v1/agent/capabilities")).json()).toMatchObject({
        generationMediaTypes: ["text/plain"],
      });
      await api.request("/v1/agent/conversations", json({ id, title: "Synthetic originals" }));
      const form = new FormData();
      form.set(
        "file",
        new File(
          [
            Buffer.from(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
              "base64",
            ),
          ],
          "notes.txt",
          { type: "text/plain" },
        ),
      );
      expect(
        (
          await api.request(`/v1/agent/conversations/${id}/attachments/${fileId}`, {
            method: "POST",
            body: form,
          })
        ).status,
      ).toBe(201);
      for (const disclosure of [undefined, false]) {
        const response = await api.request(
          `/v1/agent/conversations/${id}/turns`,
          json({ ...input(), disclosure }),
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({ status: 422 });
      }
      const refused = await api.request(`/v1/agent/conversations/${id}/turns`, json(input()));
      expect(refused.status).toBe(422);
      expect(await refused.json()).toMatchObject({
        detail: "A selected attachment format is unavailable for generation.",
      });
      expect(generate).not.toHaveBeenCalled();
      expect(
        (await app(other).request(`/v1/agent/conversations/${id}/attachments/${fileId}`)).status,
      ).toBe(404);
      const original = await api.request(`/v1/agent/conversations/${id}/attachments/${fileId}`);
      expect(original.status).toBe(200);
      expect((await original.arrayBuffer()).byteLength).toBeGreaterThan(0);
      const archive = (await (await api.request("/v1/export")).json()) as {
        store: { agentAttachments: unknown[] };
      };
      expect(archive.store.agentAttachments).toHaveLength(1);
      expect((await api.request("/v1/store")).status).toBe(200);
      const textOnly = { ...input(), attachmentIds: [] };
      const allowed = await api.request(`/v1/agent/conversations/${id}/turns`, json(textOnly));
      expect(allowed.status).toBe(200);
      await allowed.text();
      expect(generate).toHaveBeenCalledOnce();
    } finally {
      runtime.close();
      await store.close();
    }
  },
  60000,
);
