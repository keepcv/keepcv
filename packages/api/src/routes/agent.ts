import { createRoute } from "@hono/zod-openapi";
import type { AgentRuntime, UnitOfWork } from "@keepcv/core";
import { AgentRefusalError, ConcurrencyConflictError, NotFoundError } from "@keepcv/core";
import {
  agentAttachmentSchema,
  agentConversationSchema,
  agentConversationSummarySchema,
  agentGrantSchema,
  agentTurnSchema,
  timestampSchema,
  type Uuid,
  uuidSchema,
} from "@keepcv/schema";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { attachmentInput } from "../agent-attachments.js";
import { jsonResponse, problemResponse, router, sessionRequired } from "../router.js";
import { jsonBody } from "./collection.js";

const base = "/v1/agent/conversations";
const params = z.object({ id: uuidSchema });
const responses = {
  ...sessionRequired,
  404: problemResponse("No owned conversation"),
  409: problemResponse("The data changed"),
  422: problemResponse("Invalid input"),
};
const capabilities = createRoute({
  method: "get",
  path: "/v1/agent/capabilities",
  responses: {
    ...sessionRequired,
    200: jsonResponse(
      z.object({ available: z.boolean(), disclosure: z.string(), maxFileBytes: z.number() }),
      "Assistant availability",
    ),
  },
});
const list = createRoute({
  method: "get",
  path: base,
  responses: {
    ...responses,
    200: jsonResponse(
      z.object({ items: z.array(agentConversationSummarySchema) }),
      "Conversations including archived ones",
    ),
  },
});
const create = createRoute({
  method: "post",
  path: base,
  request: {
    body: jsonBody(z.object({ id: uuidSchema, title: z.string().min(1).max(200) }).strict()),
  },
  responses: { ...responses, 201: jsonResponse(agentConversationSchema, "Created") },
});
const read = createRoute({
  method: "get",
  path: `${base}/{id}`,
  request: { params },
  responses: {
    ...responses,
    200: jsonResponse(agentConversationSchema, "Conversation and history"),
  },
});
const edit = createRoute({
  method: "patch",
  path: `${base}/{id}`,
  request: {
    params,
    body: jsonBody(
      z
        .object({
          expectedUpdatedAt: timestampSchema,
          title: z.string().min(1).max(200).optional(),
          archived: z.boolean().optional(),
        })
        .strict(),
    ),
  },
  responses: { ...responses, 200: jsonResponse(agentConversationSchema, "Updated") },
});
const turn = createRoute({
  method: "post",
  path: `${base}/{id}/turns`,
  request: { params, body: jsonBody(agentTurnSchema) },
  responses: {
    ...responses,
    200: {
      description: "Assistant events; reconnect by reading the conversation",
      content: { "text/event-stream": { schema: z.string() } },
    },
  },
});
const decide = createRoute({
  method: "post",
  path: `${base}/{id}/actions/{actionId}`,
  request: {
    params: params.extend({ actionId: uuidSchema }),
    body: jsonBody(z.object({ accept: z.boolean() }).strict()),
  },
  responses: { ...responses, 200: jsonResponse(agentConversationSchema, "Decision and receipt") },
});
const grant = createRoute({
  method: "put",
  path: `${base}/{id}/grant`,
  request: { params, body: jsonBody(z.object({ grant: agentGrantSchema.nullable() }).strict()) },
  responses: {
    ...responses,
    200: jsonResponse(z.object({ saved: z.boolean() }), "Task authority updated"),
  },
});
const cancel = createRoute({
  method: "post",
  path: `${base}/{id}/cancel`,
  request: { params },
  responses: {
    ...responses,
    200: jsonResponse(z.object({ saved: z.boolean() }), "Cancellation requested"),
  },
});
const files = createRoute({
  method: "get",
  path: `${base}/{id}/attachments`,
  request: { params },
  responses: {
    ...responses,
    200: jsonResponse(
      z.object({ items: z.array(agentAttachmentSchema.omit({ data: true })) }),
      "Attachment metadata",
    ),
  },
});
const upload = createRoute({
  method: "post",
  path: `${base}/{id}/attachments/{fileId}`,
  request: {
    params: params.extend({ fileId: uuidSchema }),
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.file().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: {
    ...responses,
    413: problemResponse("File exceeds upload budget"),
    201: jsonResponse(agentAttachmentSchema.omit({ data: true }), "Original saved"),
  },
});
const archiveFile = createRoute({
  method: "patch",
  path: `${base}/{id}/attachments/{fileId}`,
  request: {
    params: params.extend({ fileId: uuidSchema }),
    body: jsonBody(
      z.object({ archived: z.boolean(), expectedUpdatedAt: timestampSchema }).strict(),
    ),
  },
  responses: {
    ...responses,
    200: jsonResponse(
      agentAttachmentSchema.omit({ data: true }),
      "Attachment availability changed",
    ),
  },
});
const download = createRoute({
  method: "get",
  path: `${base}/{id}/attachments/{fileId}`,
  request: { params: params.extend({ fileId: uuidSchema }) },
  responses: {
    ...responses,
    200: {
      description: "Original file",
      content: { "application/octet-stream": { schema: z.string() } },
    },
  },
});

export function agentRoutes(options: {
  unitOfWork: UnitOfWork;
  agent?: AgentRuntime;
  runAsOwner: <T>(ownerId: Uuid, work: () => Promise<T>) => Promise<T>;
}) {
  const unit = options.unitOfWork;
  const runtime = () => {
    if (options.agent === undefined)
      throw new AgentRefusalError("The assistant is not configured.", 503);
    return options.agent;
  };
  const app = router();
  app.use(
    `${base}/:id/attachments/:fileId`,
    bodyLimit({
      maxSize: 17 * 1024 * 1024,
      onError: (c) =>
        c.json(
          {
            type: "about:blank",
            title: "Upload too large",
            status: 413,
            detail: "Choose a file of at most 16 MiB.",
            instance: c.req.path,
          },
          413,
        ),
    }),
  );
  return app
    .openapi(capabilities, (c) =>
      c.json(
        options.agent?.capabilities ?? {
          available: false,
          disclosure:
            "The assistant is not configured. All ordinary editing and export remain available.",
          maxFileBytes: 16 * 1024 * 1024,
        },
        200,
      ),
    )
    .openapi(list, async (c) =>
      c.json({ items: await unit.run(async (r) => await r.agent.list(true)) }, 200),
    )
    .openapi(create, async (c) => {
      const input = c.req.valid("json");
      return c.json(await unit.run(async (r) => await r.agent.create(input.id, input.title)), 201);
    })
    .openapi(read, async (c) =>
      c.json(await unit.run(async (r) => await r.agent.get(c.req.valid("param").id)), 200),
    )
    .openapi(edit, async (c) => {
      const input = c.req.valid("json");
      const { id } = c.req.valid("param");
      const updated = await unit.run(async (r) => {
        const conversation = await r.agent.get(id, true);
        if (conversation.updatedAt !== input.expectedUpdatedAt)
          throw new ConcurrencyConflictError("conversation", id, conversation.updatedAt);
        if (input.title !== undefined) conversation.title = input.title;
        if (input.archived !== undefined)
          conversation.archivedAt = input.archived
            ? (new Date().toISOString() as typeof conversation.archivedAt)
            : null;
        return await r.agent.save(conversation);
      });
      return c.json(updated, 200);
    })
    .openapi(turn, async (c) => {
      const agent = runtime();
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      await unit.run(async (r) => await r.agent.get(id));
      const owner = c.get("ownerId");
      return streamSSE(c, async (stream) => {
        const controller = new AbortController();
        stream.onAbort(() => controller.abort());
        const signal = AbortSignal.any([controller.signal, c.req.raw.signal]);
        await options.runAsOwner(
          owner,
          async () =>
            await agent.turn(
              owner,
              id,
              input,
              async (event) => {
                await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
              },
              signal,
            ),
        );
      });
    })
    .openapi(decide, async (c) => {
      const { id, actionId } = c.req.valid("param");
      return c.json(
        await runtime().decide(c.get("ownerId"), id, actionId, c.req.valid("json").accept),
        200,
      );
    })
    .openapi(grant, async (c) => {
      const { id } = c.req.valid("param");
      await unit.run(async (r) => await r.agent.get(id));
      runtime().grant(c.get("ownerId"), id, c.req.valid("json").grant);
      return c.json({ saved: true }, 200);
    })
    .openapi(cancel, async (c) => {
      const { id } = c.req.valid("param");
      await unit.run(async (r) => await r.agent.get(id));
      runtime().cancel(c.get("ownerId"), id);
      return c.json({ saved: true }, 200);
    })
    .openapi(files, async (c) => {
      const rows = await unit.run(async (r) => {
        await r.agent.get(c.req.valid("param").id);
        return await r.agent.attachments(c.req.valid("param").id);
      });
      return c.json({ items: rows.map(({ data, ...metadata }) => metadata) }, 200);
    })
    .openapi(upload, async (c) => {
      const { id, fileId } = c.req.valid("param");
      const { file } = c.req.valid("form");
      const input = await attachmentInput(
        fileId,
        id,
        file.name,
        new Uint8Array(await file.arrayBuffer()),
      );
      const saved = await unit.run(async (r) => {
        await r.agent.get(id);
        return await r.agent.attach(input);
      });
      const { data, ...metadata } = saved;
      return c.json(metadata, 201);
    })
    .openapi(archiveFile, async (c) => {
      const { id, fileId } = c.req.valid("param");
      const input = c.req.valid("json");
      const saved = await unit.run(async (r) => {
        await r.agent.get(id);
        const found = (await r.agent.attachments(id)).some((file) => file.id === fileId);
        if (!found) throw new NotFoundError("attachment", fileId);
        return await r.agent.archiveAttachment(fileId, input.expectedUpdatedAt, input.archived);
      });
      const { data, ...metadata } = saved;
      return c.json(metadata, 200);
    })
    .openapi(download, async (c) => {
      const { id, fileId } = c.req.valid("param");
      const file = await unit.run(async (r) => {
        await r.agent.get(id);
        return (await r.agent.attachments(id)).find((file) => file.id === fileId);
      });
      if (file === undefined)
        return c.json(
          {
            type: "about:blank",
            title: "Not found",
            status: 404,
            detail: "No owned attachment has that ID.",
            instance: c.req.path,
          },
          404,
        );
      return new Response(Buffer.from(file.data, "base64"), {
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          "x-content-type-options": "nosniff",
          "cache-control": "no-store",
        },
      });
    });
}
