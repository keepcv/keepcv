#!/usr/bin/env node
import { parseArgs } from "node:util";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { backupStore, MIRROR_NAME, restoreStore } from "./mirror.js";
import { listing, renderResume, verdict } from "./render.js";
import { DEFAULT_DATA_DIR, DEFAULT_PORT, startServer } from "./serve.js";

const USAGE = `
  keepcv serve [options]      run the store and its API on this machine

    --port <number>           default ${DEFAULT_PORT}
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv render [resume]      write a resume to a file it can be sent as

    --out <path>              default: the resume's own name, here
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv backup               write the whole store to one readable file

    --out <path>              default: ${MIRROR_NAME} beside the store
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv restore --from <p>   load a backup into a store nothing has written to

    --from <path>             the file to read
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

`;

// In the fragment, which no browser sends to any server: a token in a query
// string would be in every log between here and nowhere.
function banner(port: number, token: string, dataDir: string, mirror: string): string {
  const origin = `http://127.0.0.1:${String(port)}`;
  return [
    "",
    "  KeepCV is running.",
    "",
    "  Open this, token and all:",
    "",
    `    ${origin}/#token=${token}`,
    "",
    `    Store   ${dataDir}`,
    `    Backup  ${mirror}`,
    `    Token   ${token}`,
    "",
    "  Every API request carries the token:",
    "",
    `    curl -H "${SESSION_TOKEN_HEADER}: ${token}" \\`,
    `      ${origin}/v1/profile`,
    "",
    `  The contract is at ${origin}/v1/openapi.json`,
    "",
    "",
  ].join("\n");
}

async function render(
  dataDir: string,
  out: string | undefined,
  named: string | undefined,
): Promise<number> {
  const result = await renderResume({ dataDir, resume: named, out });
  if ("wrote" in result) {
    process.stdout.write(`\n  Wrote ${result.wrote}\n\n${verdict(result.report)}\n`);
    return 0;
  }
  process.stderr.write(listing(result));
  return 1;
}

async function backup(dataDir: string, out: string | undefined): Promise<number> {
  const mirrored = await backupStore(dataDir, out);
  const size = `${String(Math.max(1, Math.round(mirrored.bytes / 1024)))} kB`;
  process.stdout.write(
    mirrored.written
      ? `\n  Wrote ${mirrored.path} (${size})\n\n`
      : `\n  ${mirrored.path} already says exactly this.\n\n`,
  );
  return 0;
}

async function restore(dataDir: string, from: string | undefined): Promise<number> {
  if (from === undefined) {
    process.stderr.write("\n  Name the file to read: keepcv restore --from store.json\n\n");
    return 1;
  }

  const result = await restoreStore(dataDir, from);
  if ("loaded" in result) {
    process.stdout.write(`\n  Loaded ${result.loaded} into ${dataDir}\n\n`);
    return 0;
  }
  process.stderr.write(
    result.refused === "unreadable"
      ? `\n  Cannot read ${from}\n\n`
      : `\n  ${dataDir} already holds a store. A restore never merges: point --data-dir at an empty one.\n\n`,
  );
  return 1;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      "data-dir": { type: "string" },
      out: { type: "string" },
      from: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = positionals[0];
  const dataDir = values["data-dir"] ?? DEFAULT_DATA_DIR;
  const commands = ["serve", "render", "backup", "restore"];

  if (values.help === true || command === undefined || !commands.includes(command)) {
    process.stdout.write(USAGE);
    return positionals.length === 0 || values.help === true ? 0 : 1;
  }

  if (command === "render") return await render(dataDir, values.out, positionals[1]);
  if (command === "backup") return await backup(dataDir, values.out);
  if (command === "restore") return await restore(dataDir, values.from);

  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(`  ${String(values.port)} is not a port number\n`);
    return 1;
  }

  const running = await startServer({ port, dataDir });
  process.stdout.write(banner(running.port, running.token, dataDir, running.mirror));

  // PGlite holds the data directory open, and an abrupt exit leaves it locked.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void running.stop().then(() => {
        process.exit(0);
      });
    });
  }
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
