import { homedir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { type AuthMode, createApi } from "@keepcv/api";
import { runAsOwner } from "@keepcv/db";
import { type AuthSetting, launcherAuth } from "./auth.js";
import { mirrorPath, writeMirror } from "./mirror.js";
import { openStore } from "./store.js";
import { serveWebApp, webAssetsDir } from "./web-assets.js";

// Under the home directory, not wherever this was run from.
export const DEFAULT_DATA_DIR = join(homedir(), ".keepcv");
export const DEFAULT_PORT = 4319;
export const DEFAULT_HOST = "127.0.0.1";

export interface RunningServer {
  port: number;
  host: string;
  mode: AuthMode;
  // Token mode only: the other two have a credential that outlives the run.
  token: string | undefined;
  mirror: string;
  stop: () => Promise<void>;
}

export function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

// Often enough that a hard kill costs minutes rather than a session, and the
// write is skipped when the bytes match, so an idle store touches no disk.
export const MIRROR_EVERY_MS = 5 * 60 * 1000;

export async function startServer(options: {
  port: number;
  dataDir: string;
  host?: string;
  auth?: AuthSetting;
  mirrorEveryMs?: number;
}): Promise<RunningServer> {
  const setting: AuthSetting = options.auth ?? { mode: "token" };
  const host = options.host ?? DEFAULT_HOST;
  if (!isLoopback(host) && setting.mode === "token") {
    throw new Error(
      `Serving on ${host} needs --auth password or --auth proxy: the launch token is minted per run and printed to this terminal.`,
    );
  }

  const { store, ownerId } = await openStore(options.dataDir);

  const auth = launcherAuth(setting, ownerId);
  const api = createApi({
    unitOfWork: store.unitOfWork,
    runAsOwner,
    authenticate: auth.authenticate,
  });

  // Composed here, so `createApi` knows nothing about a filesystem, a cookie or
  // a password.
  const web = serveWebApp(webAssetsDir());
  const handle = async (request: Request, from: string | undefined): Promise<Response> => {
    // Proxy mode believes a header. Anything that did not arrive through the
    // upstream could have written that header itself.
    if (!auth.trusts(from)) return new Response(null, { status: 403 });

    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/v1/")) return await api.fetch(request);
    return (await auth.routes(request)) ?? (await web(request));
  };

  const server = serve({
    fetch: (request, env) => handle(request, env.incoming.socket?.remoteAddress),
    port: options.port,
    hostname: host,
  });

  // Without the `error` arm a busy port is an unhandled event, which takes the
  // process down with a stack trace instead of saying what is on the port.
  const port = await new Promise<number>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : options.port);
    });
    server.once("error", (reason: NodeJS.ErrnoException) => {
      reject(
        reason.code === "EADDRINUSE"
          ? new Error(
              `Something is already on ${host}:${String(options.port)}. Stop it, or serve on another port with --port.`,
            )
          : reason.code === "EACCES"
            ? new Error(`Not allowed to listen on ${host}:${String(options.port)}.`)
            : reason,
      );
    });
  }).catch(async (reason: unknown) => {
    await store.close();
    throw reason;
  });

  const path = mirrorPath(options.dataDir);
  const mirror = async (): Promise<void> => {
    const archive = await runAsOwner(
      ownerId,
      async () => await store.unitOfWork.run(async (r) => await r.store.read()),
    );
    await writeMirror(path, archive);
  };

  // A mirror that failed to write must not take the launcher down with it: the
  // store is still there, and the banner says where the copy would have gone.
  const quietly = async (): Promise<void> => {
    await mirror().catch(() => undefined);
  };

  await quietly();
  const ticking = setInterval(() => {
    void quietly();
  }, options.mirrorEveryMs ?? MIRROR_EVERY_MS);
  ticking.unref();

  return {
    port,
    host,
    mode: auth.mode,
    token: auth.token,
    mirror: path,
    stop: async () => {
      clearInterval(ticking);
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await quietly();
      await store.close();
    },
  };
}
