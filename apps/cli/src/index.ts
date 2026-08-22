#!/usr/bin/env node
import { parseArgs } from "node:util";
import { SESSION_TOKEN_HEADER } from "@keepcv/api";
import { listing, renderResume, verdict } from "./render.js";
import { DEFAULT_DATA_DIR, DEFAULT_PORT, startServer } from "./serve.js";

const USAGE = `
  keepcv serve [options]      run the store and its API on this machine

    --port <number>           default ${DEFAULT_PORT}
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv render [resume]      write a resume to a file it can be sent as

    --out <path>              default: the resume's own name, here
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

`;

// In the fragment, which no browser sends to any server: a token in a query
// string would be in every log between here and nowhere.
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

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      "data-dir": { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const command = positionals[0];
  const dataDir = values["data-dir"] ?? DEFAULT_DATA_DIR;

  if (values.help === true || (command !== "serve" && command !== "render")) {
    process.stdout.write(USAGE);
    return positionals.length === 0 || values.help === true ? 0 : 1;
  }

  if (command === "render") return await render(dataDir, values.out, positionals[1]);

  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(`  ${String(values.port)} is not a port number\n`);
    return 1;
  }

  const running = await startServer({ port, dataDir });
  process.stdout.write(banner(running.port, running.token, dataDir));

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
