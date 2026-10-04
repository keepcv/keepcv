import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

async function restrictAccess(path: string, directory: boolean): Promise<void> {
  if ((await lstat(path)).isSymbolicLink()) throw new Error("Private storage cannot be a symlink.");
  if (process.platform !== "win32") {
    await chmod(path, directory ? 0o700 : 0o600);
    return;
  }
  const script = `
$ErrorActionPreference = 'Stop'
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = New-Object System.Security.AccessControl.${directory ? "DirectorySecurity" : "FileSecurity"}
$acl.SetAccessRuleProtection($true, $false)
foreach ($identity in @($sid, [System.Security.Principal.SecurityIdentifier]'S-1-5-18', [System.Security.Principal.SecurityIdentifier]'S-1-5-32-544')) {
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', '${directory ? "ContainerInherit, ObjectInherit" : "None"}', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
[System.IO.${directory ? "Directory" : "File"}]::SetAccessControl($env:KEEPCV_PRIVATE_PATH, $acl)
`;
  await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    {
      windowsHide: true,
      env: { ...process.env, KEEPCV_PRIVATE_PATH: path },
    },
  );
}

export async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await restrictAccess(path, true);
}

export async function privateFile(path: string): Promise<void> {
  await restrictAccess(path, false);
}

export async function writePrivateFile(path: string, body: string): Promise<void> {
  const parent = dirname(path);
  const created = await mkdir(parent, { recursive: true, mode: 0o700 });
  if (created !== undefined) await restrictAccess(parent, true);
  const temporary = `${path}.${randomUUID()}.writing`;
  const file = await open(temporary, "wx", 0o600);
  try {
    await restrictAccess(temporary, false);
    await file.writeFile(body, "utf8");
    await file.close();
    await rename(temporary, path);
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}
