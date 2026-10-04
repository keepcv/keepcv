import { describe, expect, it } from "vitest";
import { acceptsRequest, publicOrigin } from "./request-policy.js";

const request = (host: string, origin?: string) =>
  new Request("http://127.0.0.1:4319/v1/store", {
    headers: { host, ...(origin === undefined ? {} : { origin }) },
  });

describe("the launcher request boundary", () => {
  it("accepts loopback authorities on the listening port and refuses rebinding", () => {
    for (const host of ["127.0.0.1:4319", "localhost:4319", "[::1]:4319"]) {
      expect(acceptsRequest(request(host, `http://${host}`), 4319, undefined)).toBe(true);
      expect(acceptsRequest(request(host), 4319, undefined)).toBe(true);
    }
    for (const host of ["attacker.test:4319", "localhost.attacker.test:4319", "127.0.0.1:4320"]) {
      expect(acceptsRequest(request(host), 4319, undefined)).toBe(false);
    }
  });
  it("refuses foreign, null and mismatched loopback origins", () => {
    for (const origin of [
      "https://attacker.test",
      "null",
      "http://localhost:4319",
      "http://127.0.0.1:4320",
    ]) {
      expect(acceptsRequest(request("127.0.0.1:4319", origin), 4319, undefined)).toBe(false);
    }
  });
  it("uses the declared public origin rather than trusting forwarded headers", () => {
    const own = publicOrigin("https://cv.example.test/");
    expect(acceptsRequest(request("cv.example.test", own), 4319, own)).toBe(true);
    expect(acceptsRequest(request("cv.example.test"), 4319, own)).toBe(true);
    expect(acceptsRequest(request("cv.example.test", "http://cv.example.test"), 4319, own)).toBe(
      false,
    );
    expect(acceptsRequest(request("attacker.test", "https://attacker.test"), 4319, own)).toBe(
      false,
    );
  });
  it("rejects origins that include credentials, paths or unsupported schemes", () => {
    for (const value of [
      "file:///tmp",
      "https://user:pass@cv.test",
      "https://cv.test/path",
      "https://cv.test/?x=1",
      "https://cv.test/#token=abc",
    ]) {
      expect(() => publicOrigin(value)).toThrow(/--origin/);
    }
  });
});
