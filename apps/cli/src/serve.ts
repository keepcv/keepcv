import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createApi, sessionTokenAuth } from "@keepcv/api";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { mirrorPath, writeMirror } from "./mirror.js";
import { serveWebApp, webAssetsDir } from "./web-assets.js";

// Under the home directory, not wherever this was run from.
export const DEFAULT_DATA_DIR = join(homedir(), ".keepcv");
export const DEFAULT_PORT = 4319;

export interface RunningServer {
  port: number;
  token: string;
  mirror: string;
  stop: () => Promise<void>;
}

// Often enough that a hard kill costs minutes rather than a session, and the
// write is skipped when the bytes match, so an idle store touches no disk.
export const MIRROR_EVERY_MS = 5 * 60 * 1000;

export async function startServer(options: {
  port: number;
  dataDir: string;
  mirrorEveryMs?: number;
}): Promise<RunningServer> {
  const store = openLocalStore({ dataDir: options.dataDir });
  await store.migrate();
  const ownerId = await store.ensureLocalOwner();

  // Held in memory: a token written to disk outlives the process that needed it.
  const token = randomBytes(32).toString("base64url");

  const api = createApi({
    unitOfWork: store.unitOfWork,
    runAsOwner,
    authenticate: sessionTokenAuth(token, ownerId),
  });

  // Composed here, so `createApi` knows nothing about a filesystem and the
  // hosted adapter reuses it unchanged.
  const web = serveWebApp(webAssetsDir());
  const handle = async (request: Request): Promise<Response> =>
    new URL(request.url).pathname.startsWith("/v1/")
      ? await api.fetch(request)
      : await web(request);

  // Loopback only: nothing here is built to face a network.
  const server = serve({ fetch: handle, port: options.port, hostname: "127.0.0.1" });

  const port = await new Promise<number>((resolve) => {
    server.once("listening", () => {
      const address = server.address();
      resolve(typeof address === "object" && address !== null ? address.port : options.port);
    });
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
    token,
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
