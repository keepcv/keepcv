import { execFile } from "node:child_process";
import { chmod, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { privateDirectory, privateFile, writePrivateFile } from "./private-file.js";

describe("private file replacement", () => {
  it("writes and replaces complete files without leftover temporary data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "keepcv-private-"));
    const file = join(directory, "backup.json");
    try {
      await writePrivateFile(file, "first");
      await writePrivateFile(file, "second");
      expect(await readFile(file, "utf8")).toBe("second");
      expect(await readdir(directory)).toEqual(["backup.json"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === "win32")(
    "enforces private POSIX modes for new and existing files",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "keepcv-modes-"));
      const file = join(directory, "backup.json");
      const previous = process.umask(0o022);
      try {
        await privateDirectory(directory);
        expect((await stat(directory)).mode & 0o777).toBe(0o700);
        await writePrivateFile(file, "first");
        expect((await stat(file)).mode & 0o777).toBe(0o600);
        await chmod(file, 0o644);
        await privateFile(file);
        expect((await stat(file)).mode & 0o777).toBe(0o600);
        await chmod(file, 0o644);
        await writePrivateFile(file, "second");
        expect((await stat(file)).mode & 0o777).toBe(0o600);
      } finally {
        process.umask(previous);
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform !== "win32")(
    "removes broad inherited Windows access on files and directories",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "keepcv-acl-"));
      const file = join(directory, "backup.json");
      const run = promisify(execFile);
      try {
        await privateDirectory(directory);
        await writePrivateFile(file, "first");
        await writePrivateFile(file, "second");
        for (const [path, kind] of [
          [directory, "Directory"],
          [file, "File"],
        ]) {
          const script = `$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; [Console]::WriteLine($sid); $acl = [System.IO.${kind}]::GetAccessControl($env:KEEPCV_PRIVATE_PATH); [Console]::WriteLine($acl.AreAccessRulesProtected); foreach ($rule in $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])) { [Console]::WriteLine($rule.IdentityReference.Value) }`;
          const { stdout } = await run(
            "powershell.exe",
            [
              "-NoProfile",
              "-NonInteractive",
              "-EncodedCommand",
              Buffer.from(script, "utf16le").toString("base64"),
            ],
            { windowsHide: true, env: { ...process.env, KEEPCV_PRIVATE_PATH: path } },
          );
          const [owner, protectedRules, ...identities] = stdout.trim().split(/\r?\n/);
          expect(protectedRules).toBe("True");
          expect(identities.sort()).toEqual([owner, "S-1-5-18", "S-1-5-32-544"].sort());
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "refuses to change access through a symlink",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "keepcv-link-"));
      try {
        const target = join(directory, "target");
        await writeFile(target, "unchanged");
        const link = join(directory, "link");
        await symlink(target, link);
        await expect(privateFile(link)).rejects.toThrow("symlink");
        expect(await readFile(target, "utf8")).toBe("unchanged");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
});
