import { contentHashSchema, type RichText } from "@keepcv/schema";
import { describe, expect, it } from "vitest";
import { canonicaliseRichText } from "../richtext/canonicalise.js";
import { contentHash } from "./content-hash.js";

describe("contentHash", () => {
  it("is SHA-256 over the canonical encoding", () => {
    const body: RichText = [
      { t: "text", v: "Cut p95 latency to " },
      { t: "b", c: [{ t: "text", v: "180ms" }] },
    ];
    // Independently: sha256 of [{"t":"text","v":"Cut p95 latency to
    // "},{"c":[{"t":"text","v":"180ms"}],"t":"b"}]
    expect(contentHash(body)).toBe(
      "a712871a6d8a9c8e6628828b685104881e435142c45457f3d45f717bddc8d9fb",
    );
  });

  it("returns a value the schema accepts as a content hash", () => {
    expect(contentHashSchema.safeParse(contentHash({ any: "value" })).success).toBe(true);
  });

  it("separates values that differ", () => {
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
    expect(contentHash(["a", "b"])).not.toBe(contentHash(["b", "a"]));
  });

  it("agrees for rich text that renders identically", () => {
    const split: RichText = [
      { t: "b", c: [{ t: "text", v: "180" }] },
      { t: "b", c: [{ t: "text", v: "ms" }] },
      { t: "text", v: "" },
    ];
    const whole: RichText = [{ t: "b", c: [{ t: "text", v: "180ms" }] }];

    expect(contentHash(canonicaliseRichText(split))).toBe(contentHash(canonicaliseRichText(whole)));
    expect(contentHash(split)).not.toBe(contentHash(whole));
  });
});
