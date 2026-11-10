import { expect, it } from "vitest";
import { boundedJson, publicUrl, webConfigSchema } from "./web.js";

it.each([
  "https://localhost/",
  "https://api.localhost/",
  "https://169.254.169.254/latest/meta-data/",
  "https://127.1/",
  "https://2130706433/",
  "https://0x7f000001/",
  "https://0177.0.0.1/",
  "https://[::1]/",
  "https://[::ffff:127.0.0.1]/",
  "https://[fe80::1]/",
  "https://[fc00::1]/",
  "https://10.0.0.1/",
  "https://192.168.0.1/",
  "https://metadata.google.internal/",
  "https://example.com@localhost/",
  "https://example.com./",

  "file:///etc/passwd",
])("refuses noncanonical or nonpublic URL %s", (url) => {
  expect(publicUrl(url)).toBe(false);
});
it("requires an exact allowed hostname", () => {
  expect(publicUrl("https://example.com.evil.org/", ["example.com"])).toBe(false);
  expect(publicUrl("https://example.com/public?q=public", ["example.com"])).toBe(true);
  expect(publicUrl("https://sub.example.com/public", ["example.com"])).toBe(false);
});
it("refuses automatic and unsupported engines", () => {
  expect(
    webConfigSchema.safeParse({ search: { engine: "auto", domains: ["example.com"] } }).success,
  ).toBe(false);
  expect(
    webConfigSchema.safeParse({
      fetch: { engine: "native", domains: ["example.com"] },
    }).success,
  ).toBe(false);
});
it("stops reading an oversized provider body", async () => {
  await expect(boundedJson(new Response("x".repeat(1025)), 1024)).rejects.toThrow("byte limit");
});

it("allows ordinary web URLs without domain configuration", () => {
  for (const url of [
    "https://example.com",
    "http://example.org/page",
    "https://example.com:8443/page#part",
    "https://%65xample.com/",
  ])
    expect(publicUrl(url)).toBe(true);
  expect(webConfigSchema.parse({})).toMatchObject({
    search: { engine: "parallel", mode: "turbo" },
    fetch: { engine: "openrouter" },
    maxCalls: 8,
  });
});

it("normalizes optional domain filters and requires bare hostnames", () => {
  expect(
    webConfigSchema.parse({
      search: { engine: "parallel", mode: "turbo", domains: ["Example.COM"] },
    }).search.domains,
  ).toEqual(["example.com"]);
  expect(
    webConfigSchema.safeParse({ fetch: { engine: "openrouter", domains: ["example.com/page"] } })
      .success,
  ).toBe(false);
});
