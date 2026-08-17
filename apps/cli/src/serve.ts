import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { createApi, sessionTokenAuth } from "@keepcv/api";
import { openLocalStore, runAsOwner } from "@keepcv/db";
import { serveWebApp, webAssetsDir } from "./web-assets.js";

// Under the home directory, not wherever this was run from.
export const DEFAULT_DATA_DIR = join(homedir(), ".keepcv");
export const DEFAULT_PORT = 4319;

export interface RunningServer {
  port: number;
  token: string;
  stop: () => Promise<void>;
}

export async function startServer(options: {
  port: number;
  dataDir: string;
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

  return {
    port,
    token,
    stop: async () => {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      await store.close();
    },
  };
}
