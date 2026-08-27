import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { AUTH_MODES, type AuthMode, SESSION_TOKEN_HEADER } from "@keepcv/api";
import { type AuthSetting, readAuth, writePassword } from "./auth.js";
import { backupStore, MIRROR_NAME, restoreStore } from "./mirror.js";
import { readPiped, readSecret } from "./prompt.js";
import { costs, FORMATS, type Format, listing, renderResume, verdict } from "./render.js";
import {
  DEFAULT_DATA_DIR,
  DEFAULT_HOST,
  DEFAULT_PORT,
  type RunningServer,
  startServer,
} from "./serve.js";
import { readStatus, statusReport } from "./status.js";

const SHORTEST_PASSWORD = 8;

const COMMANDS = ["serve", "status", "set-password", "render", "backup", "restore"];

const USAGE = `
  keepcv serve [options]      run the store and its API on this machine

    --port <number>           default ${DEFAULT_PORT}
    --host <address>          default ${DEFAULT_HOST}; off loopback needs --auth
    --data-dir <path>         default ${DEFAULT_DATA_DIR}
    --auth <mode>             ${AUTH_MODES.join(" | ")}, default token
    --proxy-header <name>     --auth proxy: the header the upstream sets
    --proxy-from <address>    --auth proxy: the only address it is read from,
                              default ${DEFAULT_HOST}
    --proxy-user <value>      --auth proxy: the one user that header may name

  keepcv status               what the store holds, and where its backup is

    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv set-password         set the password --auth password asks for

    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv render [resume]      write a resume to a file it can be sent as

    --format <name>           ${FORMATS.join(" | ")}, default html
    --out <path>              default: the resume's own name, here
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv backup               write the whole store to one readable file

    --out <path>              default: ${MIRROR_NAME} beside the store
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv restore --from <p>   load a backup into a store nothing has written to

    --from <path>             the file to read
    --data-dir <path>         default ${DEFAULT_DATA_DIR}

  keepcv --version            what is installed here
  keepcv --help               this

`;

function origin(host: string, port: number): string {
  const shown =
    host === "0.0.0.0" || host === "::" ? "<this machine>" : host === "::1" ? "[::1]" : host;
  return `http://${shown}:${String(port)}`;
}

// In the fragment, which no browser sends to any server: a token in a query
// string would be in every log between here and nowhere.
function banner(running: RunningServer, dataDir: string): string {
  const where = origin(running.host, running.port);
  const token = running.token;

  const opening =
    token !== undefined
      ? ["  Open this, token and all:", "", `    ${where}/#token=${token}`]
      : running.mode === "password"
        ? [`  Open ${where} and sign in with your password.`]
        : [`  Open ${where}. Your proxy says who you are.`];

  const curl =
    token === undefined
      ? []
      : [
          "  Every API request carries the token:",
          "",
          `    curl -H "${SESSION_TOKEN_HEADER}: ${token}" \\`,
          `      ${where}/v1/profile`,
          "",
        ];

  return [
    "",
    "  KeepCV is running.",
    "",
    ...opening,
    "",
    `    Store   ${dataDir}`,
    `    Backup  ${running.mirror}`,
    `    Auth    ${running.mode}`,
    ...(token === undefined ? [] : [`    Token   ${token}`]),
    "",
    ...curl,
    `  The contract is at ${where}/v1/openapi.json`,
    "",
    "",
  ].join("\n");
}

async function setPassword(dataDir: string): Promise<number> {
  // A piped password is read once and cannot be confirmed; a typed one is
  // confirmed, because a mistyped password locks you out of your own store.
  const typed =
    process.stdin.isTTY === true ? await readSecret("\n  New password: ") : await readPiped();
  if (typed === undefined) return 1;

  if (typed.length < SHORTEST_PASSWORD) {
    process.stderr.write(
      `\n  That is ${String(typed.length)} characters. Use at least ${String(SHORTEST_PASSWORD)}.\n\n`,
    );
    return 1;
  }

  if (process.stdin.isTTY === true && (await readSecret("  Again: ")) !== typed) {
    process.stderr.write("\n  Those did not match. Nothing was changed.\n\n");
    return 1;
  }

  await writePassword(dataDir, typed);
  process.stdout.write(
    `\n  Set. Start with: keepcv serve --auth password\n\n  Any session open elsewhere has ended.\n\n`,
  );
  return 0;
}

type Chosen = { setting: AuthSetting } | { refused: string };

async function chooseAuth(
  dataDir: string,
  values: {
    auth?: string | undefined;
    "proxy-header"?: string | undefined;
    "proxy-from"?: string | undefined;
    "proxy-user"?: string | undefined;
  },
): Promise<Chosen> {
  const named = values.auth ?? "token";
  if (!AUTH_MODES.some((mode) => mode === named)) {
    return { refused: `${named} is not an auth mode. Choose one of: ${AUTH_MODES.join(", ")}` };
  }
  const mode = named as AuthMode;

  if (mode === "token") return { setting: { mode: "token" } };

  if (mode === "password") {
    const stored = await readAuth(dataDir);
    return stored === undefined
      ? { refused: `No password is set for ${dataDir}. Run: keepcv set-password` }
      : { setting: { mode: "password", stored } };
  }

  const header = values["proxy-header"];
  if (header === undefined) {
    return { refused: "--auth proxy needs --proxy-header: the header your proxy puts the user in" };
  }
  const user = values["proxy-user"];
  return {
    setting: {
      mode: "proxy",
      header,
      from: values["proxy-from"] ?? DEFAULT_HOST,
      ...(user === undefined ? {} : { user }),
    },
  };
}

async function status(dataDir: string): Promise<number> {
  const asOf = new Date().toISOString();
  process.stdout.write(`${statusReport(await readStatus(dataDir, asOf), asOf)}\n`);
  return 0;
}

async function render(
  dataDir: string,
  values: { out?: string | undefined; format?: string | undefined },
  named: string | undefined,
): Promise<number> {
  const asked = values.format ?? "html";
  if (!FORMATS.some((format) => format === asked)) {
    process.stderr.write(`\n  ${asked} is not a format. Choose one of: ${FORMATS.join(", ")}\n\n`);
    return 1;
  }

  const result = await renderResume({
    dataDir,
    resume: named,
    out: values.out,
    format: asked as Format,
  });
  if (!("wrote" in result)) {
    process.stderr.write(listing(result));
    return 1;
  }

  const said = "report" in result ? verdict(result.report) : costs(result.loss);
  process.stdout.write(`\n  Wrote ${result.wrote}\n\n${said}\n`);
  return 0;
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

  const why =
    result.refused === "missing"
      ? `There is nothing to read at ${from}`
      : result.refused === "not a backup"
        ? `${from} is not a KeepCV backup. \`keepcv backup\` writes one, and so does \`keepcv serve\`.`
        : `${dataDir} already holds a store. A restore never merges: point --data-dir at an empty one.`;
  process.stderr.write(`\n  ${why}\n\n`);
  return 1;
}

async function serveStore(
  dataDir: string,
  values: { port?: string | undefined; host?: string | undefined },
  chosen: AuthSetting,
): Promise<number> {
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write(`\n  ${String(values.port)} is not a port number\n\n`);
    return 1;
  }

  const running = await startServer({
    port,
    dataDir,
    host: values.host ?? DEFAULT_HOST,
    auth: chosen,
  });
  process.stdout.write(banner(running, dataDir));

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

// Beside the built entry point and beside the source one, so a version is read
// the same way under `node dist` and under vitest.
export async function installedVersion(): Promise<string> {
  const manifest = await readFile(new URL("../package.json", import.meta.url), "utf8");
  return (JSON.parse(manifest) as { version: string }).version;
}

function readArgs(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: "string" },
      host: { type: "string" },
      "data-dir": { type: "string" },
      auth: { type: "string" },
      "proxy-header": { type: "string" },
      "proxy-from": { type: "string" },
      "proxy-user": { type: "string" },
      out: { type: "string" },
      format: { type: "string" },
      from: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
    },
  });
}

type Args = ReturnType<typeof readArgs>;

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

async function perform(command: string, args: Args): Promise<number> {
  const { values, positionals } = args;
  const dataDir = values["data-dir"] ?? DEFAULT_DATA_DIR;

  if (command === "status") return await status(dataDir);
  if (command === "render") return await render(dataDir, values, positionals[1]);
  if (command === "backup") return await backup(dataDir, values.out);
  if (command === "restore") return await restore(dataDir, values.from);
  if (command === "set-password") return await setPassword(dataDir);

  const chosen = await chooseAuth(dataDir, values);
  if ("refused" in chosen) {
    process.stderr.write(`\n  ${chosen.refused}\n\n`);
    return 1;
  }
  return await serveStore(dataDir, values, chosen.setting);
}

// Answers an exit code for every argument list there is. A stack trace is the
// right thing for a bug in this product and the wrong thing for a busy port or
// a directory nobody can write to, and those are nearly all of these.
export async function run(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = readArgs(argv);
  } catch (reason) {
    // Node's own text goes on to explain `--` and positional arguments, which is
    // advice about a different mistake than the one that got here.
    process.stderr.write(`\n  ${messageOf(reason).split(". ")[0] ?? ""}\n${USAGE}`);
    return 1;
  }

  if (args.values.version === true) {
    process.stdout.write(`${await installedVersion()}\n`);
    return 0;
  }

  const command = args.positionals[0];
  if (args.values.help === true || command === undefined) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (!COMMANDS.includes(command)) {
    process.stderr.write(`\n  ${command} is not a keepcv command.\n${USAGE}`);
    return 1;
  }

  try {
    return await perform(command, args);
  } catch (reason) {
    process.stderr.write(`\n  ${messageOf(reason)}\n\n`);
    return 1;
  }
}
