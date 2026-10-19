import { createConnection, createServer, type Socket } from "node:net";

export async function connectionProxy(connectionString: string) {
  const backend = new URL(connectionString);
  const sockets = new Set<Socket>();
  let available = true;
  let loseCommitReply = false;
  let lostCommitReplies = 0;
  let commitLost: () => void = () => undefined;
  let holdCommitReply = false;
  let held: { socket: Socket; chunks: Buffer[] } | undefined;
  let commitReady: () => void = () => undefined;
  function track(socket: Socket): void {
    sockets.add(socket);
    socket.on("error", () => socket.destroy());
    socket.on("close", () => sockets.delete(socket));
  }
  const server = createServer((socket) => {
    track(socket);
    if (!available) {
      socket.destroy();
      return;
    }
    const upstream = createConnection({
      host: backend.hostname,
      port: Number(backend.port || 5432),
    });
    track(upstream);
    socket.pipe(upstream);
    let replies = Buffer.alloc(0);
    function interceptCommit(reply: Buffer): void {
      if (holdCommitReply) {
        holdCommitReply = false;
        held = { socket, chunks: [reply, replies] };
        replies = Buffer.alloc(0);
        commitReady();
        return;
      }
      loseCommitReply = false;
      lostCommitReplies++;
      commitLost();
      upstream.destroy();
      socket.destroy();
    }
    function forwardReplies(): void {
      while (replies.length >= 5) {
        const length = replies.readInt32BE(1) + 1;
        if (replies.length < length) return;
        const reply = replies.subarray(0, length);
        replies = replies.subarray(length);
        if (reply[0] === 67 && reply.subarray(5).toString() === "COMMIT\0") {
          interceptCommit(reply);
          return;
        }
        socket.write(reply);
      }
    }
    upstream.on("data", (chunk: Buffer) => {
      if (held?.socket === socket) {
        held.chunks.push(chunk);
        return;
      }
      if (!loseCommitReply && !holdCommitReply) {
        socket.write(chunk);
        return;
      }
      replies = Buffer.concat([replies, chunk]);
      forwardReplies();
    });
    socket.on("close", () => upstream.destroy());
    upstream.on("close", () => socket.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing proxy port");
  const url = new URL(connectionString);
  url.hostname = "127.0.0.1";
  url.port = String(address.port);
  return {
    connectionString: url.toString(),
    loseNextCommitReply: (onLost: () => void = () => undefined) => {
      loseCommitReply = true;
      commitLost = onLost;
    },
    lostCommitReplies: () => lostCommitReplies,
    holdNextCommitReply: () => {
      holdCommitReply = true;
      const ready = new Promise<void>((resolve) => {
        commitReady = resolve;
      });
      return {
        ready,
        release: () => {
          if (held === undefined) throw new Error("No COMMIT reply is held");
          held.socket.write(Buffer.concat(held.chunks));
          held = undefined;
        },
      };
    },
    setAvailable: (next: boolean) => {
      available = next;
      if (!available) for (const socket of sockets) socket.destroy();
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error === undefined ? resolve() : reject(error))),
      );
    },
  };
}
