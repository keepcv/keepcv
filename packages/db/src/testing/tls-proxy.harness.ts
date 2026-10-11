import { readFile } from "node:fs/promises";
import { createConnection, createServer, type Socket } from "node:net";
import { createSecureContext, TLSSocket } from "node:tls";

export async function tlsProxy(connectionString: string, certificate = "server.pem") {
  const backend = new URL(connectionString);
  const context = createSecureContext({
    cert: await readFile(new URL(`./tls/${certificate}`, import.meta.url)),
    key: await readFile(new URL("./tls/server-key.pem", import.meta.url)),
  });
  const sockets = new Set<Socket>();
  function track(socket: Socket): void {
    sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
  }
  const server = createServer((socket) => {
    track(socket);
    socket.once("data", (request: Buffer) => {
      if (request.length !== 8 || request.readInt32BE(4) !== 80877103) {
        socket.destroy(new Error("Expected PostgreSQL SSLRequest"));
        return;
      }
      socket.write("S");
      const secure = new TLSSocket(socket, { isServer: true, secureContext: context });
      track(secure);
      secure.once("secure", () => {
        const upstream = createConnection({
          host: backend.hostname,
          port: Number(backend.port || 5432),
        });
        track(upstream);
        secure.pipe(upstream).pipe(secure);
        secure.on("close", () => upstream.destroy());
        upstream.on("close", () => secure.destroy());
      });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing TLS proxy port");
  const url = new URL(connectionString);
  url.hostname = "localhost";
  url.port = String(address.port);
  return {
    connectionString: url.toString(),
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    },
  };
}
