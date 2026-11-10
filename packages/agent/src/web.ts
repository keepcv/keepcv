import { isIP } from "node:net";
import { z } from "zod";

export function publicUrl(value: string, domains?: readonly string[]): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      value.startsWith(`https://${host}/`) &&
      isIP(host) === 0 &&
      !host.includes(":") &&
      /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?)+$/.test(host) &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host) &&
      !/^\d+(?:\.\d+)*$/.test(host) &&
      (domains === undefined || domains.includes(host))
    );
  } catch {
    return false;
  }
}

const domains = z
  .array(z.string().refine((host) => publicUrl(`https://${host}/`)))
  .min(1)
  .max(20);
export const webConfigSchema = z
  .object({
    search: z
      .object({ engine: z.literal("parallel"), mode: z.literal("turbo"), domains })
      .strict()
      .optional(),
    fetch: z
      .object({ engine: z.literal("openrouter"), domains })
      .strict()
      .optional(),
    maxCalls: z.number().int().min(1).max(4).default(2),
    maxResults: z.number().int().min(1).max(10).default(5),
    maxCharacters: z.number().int().min(1).max(10000).default(1500),
    maxContentTokens: z.number().int().min(1).max(10000).default(2000),
    maxResponseBytes: z.number().int().min(1024).max(262144).default(65536),
    deadlineMs: z.number().int().min(1000).max(30000).default(15000),
  })
  .strict();

export async function boundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = response.body?.getReader();
  if (reader === undefined) throw new Error("Missing provider body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error("Provider body exceeds the configured byte limit");
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } finally {
    await reader.cancel();
  }
}

export const serverToolUsageSchema = z.object({
  tool_calls_requested: z.number().int().nonnegative(),
  tool_calls_executed: z.number().int().nonnegative(),
  web_search_requests: z.number().int().nonnegative().optional(),
});
