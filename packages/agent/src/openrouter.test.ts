import { agentAttachmentSchema } from "@keepcv/schema";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { agentConfigSchema, createOpenRouterModel, providerError } from "./openrouter.js";
import type { ModelRequest } from "./runtime.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function modelRequest(): ModelRequest {
  return {
    messages: [{ role: "user", content: "Private career note" }],
    attachments: [],
    context: "/profile",
    publicResearchQuery: undefined,
    signal: new AbortController().signal,
    text: () => Promise.resolve(),
    read: () => Promise.resolve([]),
    describe: () => [],
    propose: () => Promise.resolve("pending"),
  };
}

function streamReply(delta: unknown, finishReason = "stop") {
  const chunk = (value: unknown, finish: string | null) => ({
    id: "synthetic",
    object: "chat.completion.chunk",
    created: 1,
    model: "qualified/model",
    choices: [{ index: 0, delta: value, finish_reason: finish }],
  });
  return new Response(
    [chunk(delta, null), chunk({}, finishReason)]
      .map((value) => `data: ${JSON.stringify(value)}\n\n`)
      .join("") + "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}

it("fails over before output and preserves configured routing constraints", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const models: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const body = z
      .object({
        model: z.string(),
        provider: z.object({
          only: z.array(z.string()),
          allow_fallbacks: z.literal(false),
          require_parameters: z.literal(true),
        }),
      })
      .parse(await new Request(input, init).json());
    models.push(body.model);
    return models.length === 1
      ? Response.json({ error: { code: 503, message: "Synthetic outage" } }, { status: 503 })
      : streamReply({ content: "Recovered" });
  });
  const model = createOpenRouterModel(
    agentConfigSchema.parse({
      routes: [
        { model: "qualified/primary", providers: ["approved"] },
        { model: "qualified/backup", providers: ["approved"] },
      ],
    }),
    { OPENROUTER_API_KEY: "synthetic" },
  );
  expect((await model.generate(modelRequest())).text).toBe("Recovered");
  expect(models).toEqual(["qualified/primary", "qualified/backup"]);
  expect(logged).not.toHaveBeenCalled();
});

it("does not replay a model attempt after an application tool acknowledges a change", async () => {
  const fetcher = vi.fn<typeof fetch>();
  fetcher.mockImplementationOnce(() =>
    Promise.resolve(
      streamReply(
        {
          tool_calls: [
            {
              index: 0,
              id: "call_proposal",
              type: "function",
              function: {
                name: "propose_changes",
                arguments: JSON.stringify({
                  summary: "Rename",
                  operations: [{ type: "profile.update", patch: { fullName: "Ada" } }],
                }),
              },
            },
          ],
        },
        "tool_calls",
      ),
    ),
  );
  fetcher.mockImplementation(() =>
    Promise.resolve(
      Response.json({ error: { code: 503, message: "Synthetic outage" } }, { status: 503 }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  const model = createOpenRouterModel(
    agentConfigSchema.parse({
      routes: [
        { model: "qualified/primary", providers: ["approved"] },
        { model: "qualified/backup", providers: ["approved"] },
      ],
    }),
    { OPENROUTER_API_KEY: "synthetic" },
  );
  const propose = vi.fn(() => Promise.resolve("Applied with a saved receipt"));
  await expect(model.generate({ ...modelRequest(), propose })).rejects.toMatchObject({
    code: "unavailable",
  });
  expect(propose).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("retains truncated text as a failure without replaying on another model", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(() =>
      Promise.resolve(streamReply({ content: "Partial answer" }, "length")),
    );
  vi.stubGlobal("fetch", fetcher);
  const model = createOpenRouterModel(
    agentConfigSchema.parse({ routes: [{ model: "qualified/model", providers: ["approved"] }] }),
    { OPENROUTER_API_KEY: "synthetic" },
  );
  const request = modelRequest();
  const text = vi.fn(request.text);
  await expect(model.generate({ ...request, text })).rejects.toMatchObject({
    code: "incomplete",
    retryable: false,
  });
  expect(text).toHaveBeenCalledWith("Partial answer");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("keeps hosted research on the exact public query and preserves citations", async () => {
  const nativeBodies: unknown[] = [];
  let step = 0;
  vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const body = z
      .object({ stream: z.boolean(), messages: z.array(z.unknown()) })
      .loose()
      .parse(await new Request(input, init).json());
    if (!body.stream) {
      nativeBodies.push(body);
      return Response.json({
        choices: [
          {
            message: {
              content: "Grounded finding",
              annotations: [
                {
                  type: "url_citation",
                  url_citation: { title: "Public source", url: "https://example.com/public" },
                },
              ],
            },
            finish_reason: "stop",
          },
        ],
      });
    }
    step++;
    return step === 1
      ? streamReply(
          {
            tool_calls: [
              {
                index: 0,
                id: "call_search",
                type: "function",
                function: {
                  name: "research",
                  arguments: JSON.stringify({ query: "Public resume question" }),
                },
              },
            ],
          },
          "tool_calls",
        )
      : streamReply({ content: "Grounded answer" });
  });
  const route = { model: "qualified/model", providers: ["approved"] };
  const model = createOpenRouterModel(
    agentConfigSchema.parse({
      routes: [route],
      research: route,
      nativeSearchPolicyConfirmed: true,
    }),
    { OPENROUTER_API_KEY: "synthetic" },
  );
  const answer = await model.generate({
    ...modelRequest(),
    publicResearchQuery: "Public resume question",
  });
  expect(answer.sources).toEqual([{ title: "Public source", url: "https://example.com/public" }]);
  expect(nativeBodies).toHaveLength(1);
  expect(JSON.stringify(nativeBodies)).not.toContain("Private career note");
  expect(JSON.stringify(nativeBodies)).toContain('"engine":"native"');
});

it("distinguishes exhausted credits, transient budgets and safe retry delays", () => {
  expect(providerError({ statusCode: 402 }).retryable).toBe(false);
  expect(providerError({ statusCode: 401 }).code).toBe("configuration");
  expect(
    providerError({ statusCode: 429, responseHeaders: { "retry-after": "12" } }),
  ).toMatchObject({ retryable: true, retryAfterMs: 12000 });
  expect(
    providerError({
      statusCode: 402,
      headers: new Headers({ "retry-after": "2" }),
      data: { error: { metadata: { limit_source: "openrouter_in_flight_budget" } } },
    }),
  ).toMatchObject({ code: "busy", retryable: true, retryAfterMs: 2000 });
  expect(
    providerError({ code: 400, metadata: { error_type: "context_length_exceeded" } }).code,
  ).toBe("context");
});

it("refuses missing credentials and unqualified hosted search at startup", () => {
  const route = { model: "qualified/model", providers: ["approved"] };
  expect(() => createOpenRouterModel(agentConfigSchema.parse({ routes: [route] }), {})).toThrow(
    "OPENROUTER_API_KEY",
  );
  expect(() =>
    createOpenRouterModel(agentConfigSchema.parse({ routes: [route], research: route }), {
      OPENROUTER_API_KEY: "synthetic",
    }),
  ).toThrow("native-only");
});

it("sends PDF bytes only to the fixed inference endpoint and refuses incomplete findings", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ choices: [{ message: { content: "unfinished" }, finish_reason: "length" }] }),
    );
  vi.stubGlobal("fetch", fetcher);
  const model = createOpenRouterModel(
    agentConfigSchema.parse({
      routes: [{ model: "qualified/pdf", providers: ["approved"], pdf: true }],
    }),
    { OPENROUTER_API_KEY: "synthetic" },
  );
  const request: ModelRequest = {
    messages: [{ role: "user", content: "Read my resume" }],
    attachments: [
      agentAttachmentSchema.parse({
        id: "01900000-0000-7000-8000-000000000001",
        conversationId: "01900000-0000-7000-8000-000000000002",
        name: "resume.pdf",
        mediaType: "application/pdf",
        data: "JVBERg==",
        createdAt: "2026-10-31T00:00:00.000Z",
        updatedAt: "2026-10-31T00:00:00.000Z",
        archivedAt: null,
      }),
    ],
    context: "/",
    publicResearchQuery: undefined,
    signal: new AbortController().signal,
    text: async () => {},
    read: () => Promise.resolve([]),
    describe: () => [],
    propose: () => Promise.resolve("pending"),
  };
  await expect(model.generate(request)).rejects.toMatchObject({
    code: "incomplete",
    retryable: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://openrouter.ai/api/v1/chat/completions");
  const body = String(fetcher.mock.calls[0]?.[1]?.body);
  expect(body).toContain('"allow_fallbacks":false');
  expect(body).toContain('"engine":"native"');
  expect(body).toContain("data:application/pdf;base64,JVBERg==");
});
