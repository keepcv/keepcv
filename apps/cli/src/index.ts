#!/usr/bin/env node
import { parseArgs } from "node:util";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { DEFAULT_DATA_DIR, DEFAULT_PORT, startServer } from "./serve.js";

const USAGE = `
  keepcv serve [options]      run the store and its API on this machine

    --port <number>           default ${DEFAULT_PORT}
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

`;

// The token travels in the fragment, which no browser sends to any server: a
// page on another origin that fetches this one gets HTML with the token nowhere
// in it, and nothing lands in a proxy log. The app claims it once and keeps it
// for the tab.
function banner(port: number, token: string, dataDir: string): string {
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

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      "data-dir": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help === true || positionals[0] !== "serve") {
    process.stdout.write(USAGE);
    return positionals.length === 0 || values.help === true ? 0 : 1;
  }

  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(`  ${String(values.port)} is not a port number\n`);
    return 1;
  }

  const dataDir = values["data-dir"] ?? DEFAULT_DATA_DIR;
  const running = await startServer({ port, dataDir });
  process.stdout.write(banner(running.port, running.token, dataDir));

  // PGlite holds the data directory open, so an abrupt exit leaves it locked
  // against the next launch.
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
