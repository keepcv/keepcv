import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { run } from "./cli.js";
import { ENV_OPTIONS, environmentOptions, writeConfig } from "./config.js";
import { backupStore, restoreStore } from "./mirror.js";
import { renderResume } from "./render.js";
import { startServer } from "./serve.js";

vi.mock("./serve.js", async (original) => ({
  ...(await original<typeof import("./serve.js")>()),
  startServer: vi.fn(),
}));
vi.mock("./mirror.js", async (original) => ({
  ...(await original<typeof import("./mirror.js")>()),
  backupStore: vi.fn(),
  restoreStore: vi.fn(),
}));
vi.mock("./render.js", async (original) => ({
  ...(await original<typeof import("./render.js")>()),
  renderResume: vi.fn(),
}));

let directory: string | undefined;
beforeEach(() => {
  for (const variable of Object.values(ENV_OPTIONS)) vi.stubEnv(variable, undefined);
  vi.mocked(startServer).mockClear();
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.spyOn(process.stderr, "write").mockReturnValue(true);
  vi.spyOn(process, "once").mockReturnValue(process);
  vi.mocked(startServer).mockResolvedValue({
    port: 5000,
    host: "localhost",
    mode: "token",
    origin: undefined,
    token: "test",
    mirror: "backup",
    stop: async () => {},
  });
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
});

it("resolves the environment data directory before loading its settings and lets flags win", async () => {
  directory = await mkdtemp(join(tmpdir(), "keepcv-env-"));
  await writeConfig(directory, { port: 5000, host: "localhost" });
  vi.stubEnv("KEEPCV_DATA_DIR", directory);
  vi.stubEnv("KEEPCV_PORT", "6000");
  vi.stubEnv("KEEPCV_HOST", "127.0.0.1");
  expect(await run(["serve"])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({ dataDir: directory, port: 6000, host: "127.0.0.1" }),
  );
  expect(await run(["serve", "--port", "7000", "--host", "localhost"])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({ dataDir: directory, port: 7000, host: "localhost" }),
  );
  vi.stubEnv("KEEPCV_DATA_DIR", join(directory, "missing"));
  expect(await run(["serve", "--data-dir", directory])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(expect.objectContaining({ dataDir: directory }));
});

it("uses environment proxy authentication and agent configuration", async () => {
  directory = await mkdtemp(join(tmpdir(), "keepcv-env-"));
  vi.stubEnv("KEEPCV_DATA_DIR", directory);
  vi.stubEnv("KEEPCV_HOST", "0.0.0.0");
  vi.stubEnv("KEEPCV_AUTH", "proxy");
  vi.stubEnv("KEEPCV_ORIGIN", "https://cv.example.test");
  vi.stubEnv("KEEPCV_PROXY_HEADER", "X-User");
  vi.stubEnv("KEEPCV_PROXY_FROM", "10.0.0.1");
  vi.stubEnv("KEEPCV_PROXY_USER", "owner");
  vi.stubEnv("KEEPCV_AGENT_CONFIG", "/config/agent.json");
  expect(await run(["serve"])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({
      host: "0.0.0.0",
      origin: "https://cv.example.test",
      agentConfig: "/config/agent.json",
      auth: { mode: "proxy", header: "X-User", from: "10.0.0.1", user: "owner" },
    }),
  );
});

it("refuses invalid environment ports unless an explicit flag overrides them", async () => {
  directory = await mkdtemp(join(tmpdir(), "keepcv-env-"));
  vi.stubEnv("KEEPCV_DATA_DIR", directory);
  vi.stubEnv("KEEPCV_PORT", "invalid");
  expect(await run(["serve"])).toBe(1);
  expect(startServer).not.toHaveBeenCalled();
  expect(await run(["serve", "--port", "6000"])).toBe(0);
});

it("ignores blank optional environment values and keeps saved settings", async () => {
  directory = await mkdtemp(join(tmpdir(), "keepcv-env-"));
  await writeConfig(directory, { port: 5000 });
  vi.stubEnv("KEEPCV_DATA_DIR", directory);
  vi.stubEnv("KEEPCV_PORT", "");
  vi.stubEnv("KEEPCV_HOST", "   ");
  expect(await run(["serve"])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({ port: 5000, host: "127.0.0.1" }),
  );
  expect(
    environmentOptions({ KEEPCV_AUTH: "", KEEPCV_AGENT_CONFIG: " ", UNRELATED: "value" }),
  ).toEqual({});
});

it("applies environment paths to backup and restore without requiring command flags", async () => {
  vi.stubEnv("KEEPCV_DATA_DIR", "/data");
  vi.stubEnv("KEEPCV_OUT", "/backup/store.json");
  vi.mocked(backupStore).mockResolvedValue({
    written: true,
    path: "/backup/store.json",
    bytes: 100,
  });
  expect(await run(["backup"])).toBe(0);
  expect(backupStore).toHaveBeenLastCalledWith("/data", "/backup/store.json");
  vi.stubEnv("KEEPCV_FROM", "/backup/store.json");
  vi.mocked(restoreStore).mockResolvedValue({ loaded: "/backup/store.json" });
  expect(await run(["restore"])).toBe(0);
  expect(restoreStore).toHaveBeenLastCalledWith("/data", "/backup/store.json");
});

it("uses environment render options and lets explicit options override them", async () => {
  vi.stubEnv("KEEPCV_DATA_DIR", "/data");
  vi.stubEnv("KEEPCV_FORMAT", "typst");
  vi.stubEnv("KEEPCV_OUT", "/output/resume.typ");
  vi.mocked(renderResume).mockResolvedValue({ wrote: "/output/resume.typ", loss: [] });
  expect(await run(["render", "My resume"])).toBe(0);
  expect(renderResume).toHaveBeenLastCalledWith({
    dataDir: "/data",
    resume: "My resume",
    format: "typst",
    out: "/output/resume.typ",
  });
  expect(
    await run(["render", "My resume", "--format", "docx", "--out", "/output/resume.docx"]),
  ).toBe(0);
  expect(renderResume).toHaveBeenLastCalledWith({
    dataDir: "/data",
    resume: "My resume",
    format: "docx",
    out: "/output/resume.docx",
  });
});

it("loads saved settings and lets explicit serve flags override them", async () => {
  directory = await mkdtemp(join(tmpdir(), "keepcv-config-"));
  await writeConfig(directory, { port: 5000, host: "localhost", auth: "token" });
  vi.spyOn(process.stdout, "write").mockReturnValue(true);
  vi.spyOn(process, "once").mockReturnValue(process);
  vi.mocked(startServer).mockResolvedValue({
    port: 5000,
    host: "localhost",
    mode: "token",
    origin: undefined,
    token: "test",
    mirror: "backup",
    stop: async () => {},
  });
  expect(await run(["serve", "--data-dir", directory])).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({ port: 5000, host: "localhost", auth: { mode: "token" } }),
  );
  expect(
    await run(["serve", "--data-dir", directory, "--port", "6000", "--host", "127.0.0.1"]),
  ).toBe(0);
  expect(startServer).toHaveBeenLastCalledWith(
    expect.objectContaining({ port: 6000, host: "127.0.0.1" }),
  );
});
