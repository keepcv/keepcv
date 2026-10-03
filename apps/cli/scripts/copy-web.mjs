import { cpSync, existsSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const from = new URL("dist/", pathToFileURL(require.resolve("@keepcv/web/package.json")));
const to = new URL("../dist/web/", import.meta.url);

if (!existsSync(from)) {
  console.error("@keepcv/web is not built. Build through turbo, which builds it first.");
  process.exit(1);
}

// Emptied first: Vite names assets by content hash, so a stale build's files
// would otherwise accumulate here and ship in the tarball forever.
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
