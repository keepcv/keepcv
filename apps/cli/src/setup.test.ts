import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prompts from "@clack/prompts";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authPath, readAuth, verifyPassword } from "./auth.js";
import { configPath, readConfig, writeConfig } from "./config.js";
import { setup } from "./setup.js";

vi.mock("@clack/prompts", () => ({
  CANCEL_SYMBOL: Symbol("cancel"),
  intro: vi.fn(),
  note: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  isCancel: (value: unknown) => typeof value === "symbol",
}));

let directory: string;
const inputTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const outputTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

beforeEach(async () => {
  vi.clearAllMocks();
  directory = await mkdtemp(join(tmpdir(), "keepcv-setup-"));
  Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
});

afterEach(async () => {
  for (const [stream, descriptor] of [
    [process.stdin, inputTTY],
    [process.stdout, outputTTY],
  ] as const) {
    if (descriptor === undefined) Reflect.deleteProperty(stream, "isTTY");
    else Object.defineProperty(stream, "isTTY", descriptor);
  }
  await rm(directory, { recursive: true, force: true });
});

it("skips all optional sections and saves defaults without asking for credentials", async () => {
  vi.mocked(prompts.confirm)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  expect(await setup(directory)).toBe(0);
  expect(await readConfig(directory)).toEqual({});
  expect(prompts.password).not.toHaveBeenCalled();
  expect(prompts.text).not.toHaveBeenCalled();
});

it("collects AI follow-up answers only after opt-in", async () => {
  vi.mocked(prompts.confirm)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true);
  vi.mocked(prompts.text)
    .mockResolvedValueOnce("qualified/model")
    .mockResolvedValueOnce("first, second");
  vi.mocked(prompts.password).mockResolvedValueOnce("secret-key");
  expect(await setup(directory)).toBe(0);
  expect(await readConfig(directory)).toMatchObject({
    openRouterApiKey: "secret-key",
    agent: {
      routes: [
        { model: "qualified/model", providers: ["first", "second"], images: false, pdf: false },
      ],
    },
  });
  expect(JSON.stringify(vi.mocked(prompts.outro).mock.calls)).not.toContain("secret-key");
});

it("cancels without changing existing settings or password credentials", async () => {
  await writeConfig(directory, { port: 5000 });
  const before = await readFile(configPath(directory), "utf8");
  vi.mocked(prompts.confirm).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  vi.mocked(prompts.select).mockResolvedValueOnce("password");
  vi.mocked(prompts.password)
    .mockResolvedValueOnce("new-password")
    .mockResolvedValueOnce(prompts.CANCEL_SYMBOL);
  expect(await setup(directory)).toBe(1);
  expect(await readFile(configPath(directory), "utf8")).toBe(before);
  await expect(readFile(authPath(directory))).rejects.toMatchObject({ code: "ENOENT" });
});

it("stores password authentication and server settings after final confirmation", async () => {
  vi.mocked(prompts.confirm)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  vi.mocked(prompts.text)
    .mockResolvedValueOnce("0.0.0.0")
    .mockResolvedValueOnce("5000")
    .mockResolvedValueOnce("http://localhost:5000");
  vi.mocked(prompts.select).mockResolvedValueOnce("password");
  vi.mocked(prompts.password)
    .mockResolvedValueOnce("new-password")
    .mockResolvedValueOnce("new-password");
  expect(await setup(directory)).toBe(0);
  expect(await readConfig(directory)).toMatchObject({
    host: "0.0.0.0",
    port: 5000,
    auth: "password",
    origin: "http://localhost:5000",
  });
  const auth = await readAuth(directory);
  expect(auth).toBeDefined();
  expect(await verifyPassword("new-password", auth?.hash ?? "")).toBe(true);
  expect(await readFile(authPath(directory), "utf8")).not.toContain("new-password");
});

it("disables AI without collecting model details", async () => {
  await writeConfig(directory, {
    openRouterApiKey: "old-key",
    agent: {
      routes: [
        {
          model: "model",
          providers: ["provider"],
          apiKeyEnv: "OPENROUTER_API_KEY",
          images: false,
          pdf: false,
        },
      ],
      deadlineMs: 90000,
      nativeSearchPolicyConfirmed: false,
    },
  });
  vi.mocked(prompts.confirm)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  expect(await setup(directory)).toBe(0);
  expect(await readConfig(directory)).toEqual({});
  expect(prompts.password).not.toHaveBeenCalled();
});

it("rejects noninteractive setup before any write", async () => {
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  await expect(setup(directory)).rejects.toThrow("interactive terminal");
  expect(prompts.confirm).not.toHaveBeenCalled();
  expect(await readConfig(directory)).toEqual({});
});

it("refuses malformed saved configuration without exposing secrets", async () => {
  await writeFile(configPath(directory), '{"port":"secret-key"}');
  await expect(readConfig(directory)).rejects.toThrow("Invalid configuration");
  await expect(readConfig(directory)).rejects.not.toThrow("secret-key");
});
