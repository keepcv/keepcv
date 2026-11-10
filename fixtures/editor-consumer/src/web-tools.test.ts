import { agentConfigSchema, createOpenRouterModel, type ModelRequest } from "@keepcv/agent";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

function stream(delta: unknown, finish = "stop") {
  return new Response(
    `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: finish }] })}\n\n` +
      "data: [DONE]\n\n",
    { headers: { "content-type": "text/event-stream" } },
  );
}

it.each(["disabled", "search", "fetch"])(
  "uses installed bounded web tools with %s selected",
  async (mode) => {
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const body = await new Request(input, init).text();
      bodies.push(body);
      if (mode === "disabled" || bodies.length === 3)
        return stream({ content: "Synthetic answer" });
      if (bodies.length === 1)
        return stream(
          {
            tool_calls: [
              {
                index: 0,
                id: "public",
                type: "function",
                function: {
                  name: mode === "search" ? "web_search" : "web_fetch",
                  arguments: JSON.stringify(
                    mode === "search"
                      ? { query: "Public question" }
                      : { url: "https://example.com/public" },
                  ),
                },
              },
            ],
          },
          "tool_calls",
        );
      return Response.json({
        usage: { server_tool_use_details: { tool_calls_requested: 1, tool_calls_executed: 1 } },
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: "Public findings",
              ...(mode === "search"
                ? {
                    annotations: [
                      {
                        type: "url_citation",
                        url_citation: { url: "https://example.com/public", title: "Public source" },
                      },
                    ],
                  }
                : {}),
            },
          },
        ],
      });
    });
    const route = { model: "synthetic/model", providers: ["synthetic"] };
    const model = createOpenRouterModel(
      agentConfigSchema.parse({
        routes: [route],
        research: route,
        web: {
          search: { engine: "parallel", mode: "turbo", domains: ["example.com"] },
          fetch: { engine: "openrouter", domains: ["example.com"] },
        },
      }),
      { OPENROUTER_API_KEY: "synthetic" },
    );
    const request: ModelRequest = {
      messages: [{ role: "user", content: "Synthetic private career note" }],
      attachments: [],
      context: "/profile",
      publicResearchQuery: undefined,
      webSearchEnabled: mode !== "disabled",
      signal: new AbortController().signal,
      text: () => Promise.resolve(),
      read: () => Promise.resolve([]),
      describe: () => [],
      propose: () => Promise.resolve("pending"),
    };
    const reply = await model.generate(request);
    expect(model.webSearchAvailable).toBe(true);
    expect(bodies[0]?.includes('"name":"web_search"')).toBe(mode !== "disabled");
    if (mode === "disabled") expect(bodies).toHaveLength(1);
    else {
      expect(bodies).toHaveLength(3);
      expect(bodies[1]).not.toContain("Synthetic private career note");
      expect(bodies[1]).toContain(
        mode === "search" ? '"engine":"parallel"' : '"engine":"openrouter"',
      );
      expect(reply.sources[0]).toMatchObject({
        url: "https://example.com/public",
        provenance: mode === "search" ? "citation" : "requested-url",
      });
    }
  },
);
