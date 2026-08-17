import { beforeEach, describe, expect, it } from "vitest";
import { claimSessionToken, forgetSessionToken } from "./session.js";

function aStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => {
      values.clear();
    },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

function aLocation(hash: string): Location {
  return { hash, pathname: "/records", search: "?kind=project" } as Location;
}

let storage: Storage;

beforeEach(() => {
  storage = aStorage();
  history.replaceState(null, "", "/");
});

describe("claiming the session token", () => {
  it("takes it from the fragment and keeps it for the tab", () => {
    expect(claimSessionToken(aLocation("#token=abc123"), storage)).toBe("abc123");
    expect(claimSessionToken(aLocation(""), storage)).toBe("abc123");
  });

  // An address bar gets screenshotted and pasted into issues.
  it("removes the token from the address bar, keeping the rest of the URL", () => {
    claimSessionToken(aLocation("#token=abc123"), storage);
    expect(window.location.pathname).toBe("/records");
    expect(window.location.search).toBe("?kind=project");
    expect(window.location.hash).toBe("");
  });

  it("has nothing when nobody has been given a token", () => {
    expect(claimSessionToken(aLocation(""), storage)).toBeUndefined();
  });

  // A token is minted per launch, so the fragment of the URL just opened wins
  // over whatever the tab remembered from the previous one.
  it("prefers the fragment over a token the tab already held", () => {
    claimSessionToken(aLocation("#token=from-the-last-launch"), storage);
    expect(claimSessionToken(aLocation("#token=from-this-launch"), storage)).toBe(
      "from-this-launch",
    );
  });

  it("ignores an empty token rather than storing one", () => {
    claimSessionToken(aLocation("#token=real"), storage);
    expect(claimSessionToken(aLocation("#token="), storage)).toBe("real");
  });

  it("forgets one on request", () => {
    claimSessionToken(aLocation("#token=abc123"), storage);
    forgetSessionToken(storage);
    expect(claimSessionToken(aLocation(""), storage)).toBeUndefined();
  });
});
