import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installedVersion, run } from "./cli.js";

interface Said {
  code: number;
  out: string;
  err: string;
}

async function keepcv(...argv: string[]): Promise<Said> {
  let out = "";
  let err = "";
  const write = (into: (text: string) => void) => (chunk: unknown) => {
    into(String(chunk));
    return true;
  };
  vi.spyOn(process.stdout, "write").mockImplementation(
    write((text) => {
      out += text;
    }),
  );
  vi.spyOn(process.stderr, "write").mockImplementation(
    write((text) => {
      err += text;
    }),
  );

  return { code: await run(argv), out, err };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what keepcv answers before it opens anything", () => {
  it("prints what is installed", async () => {
    const said = await keepcv("--version");
    expect(said.code).toBe(0);
    expect(said.out.trim()).toBe(await installedVersion());
  });

  it("prints the commands when asked for nothing, and succeeds", async () => {
    const said = await keepcv();
    expect(said.code).toBe(0);
    expect(said.out).toContain("keepcv serve");
    expect(said.out).toContain("keepcv status");
  });

  it("prints the commands for --help", async () => {
    expect(await keepcv("--help")).toMatchObject({ code: 0 });
  });

  // A typo'd flag reached Node's own ERR_PARSE_ARGS_UNKNOWN_OPTION and came out
  // as an internal stack trace.
  it("names a flag it does not know, without the advice about positionals", async () => {
    const said = await keepcv("serve", "--prot", "5000");
    expect(said.code).toBe(1);
    expect(said.err).toContain("Unknown option '--prot'");
    expect(said.err).not.toContain("place it at the end");
    expect(said.err).toContain("keepcv serve");
  });

  it("names a command it does not know", async () => {
    const said = await keepcv("deploy");
    expect(said.code).toBe(1);
    expect(said.err).toContain("deploy is not a keepcv command");
  });

  it("refuses a port that is not one, before opening a store", async () => {
    expect(await keepcv("serve", "--port", "http")).toMatchObject({ code: 1 });
  });

  it("refuses a format it does not write, before opening a store", async () => {
    const said = await keepcv("render", "--format", "rtf");
    expect(said.code).toBe(1);
    expect(said.err).toContain("rtf is not a format");
    expect(said.err).toContain("jsonresume");
  });

  it("asks for the file a restore reads", async () => {
    const said = await keepcv("restore");
    expect(said.code).toBe(1);
    expect(said.err).toContain("--from");
  });
});

describe("what keepcv says when the store is not there", () => {
  // Every one of these used to surface as whichever mkdir or query was in
  // flight, which reads as a bug in this product rather than as a bad path.
  it("says it cannot open a data directory that cannot exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "keepcv-cli-"));
    try {
      const file = join(dir, "afile");
      await writeFile(file, "not a directory", "utf8");

      const said = await keepcv("status", "--data-dir", join(file, "store"));
      expect(said.code).toBe(1);
      expect(said.err).toContain("Cannot open the store at");
      expect(said.err.trim().split("\n")).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
