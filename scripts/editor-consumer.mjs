import assert from "node:assert/strict";
import { cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export async function prepareEditorConsumer(root, installed, tarballs) {
  await cp(join(root, "fixtures/editor-consumer"), installed, { recursive: true });
  const dependencies = {};
  for (const name of ["api", "core", "db", "editor", "schema"]) {
    dependencies[`@keepcv/${name}`] = tarballs[`@keepcv/${name}`];
  }
  for (const name of [
    "react",
    "react-dom",
    "@tanstack/react-query",
    "@tanstack/react-router",
    "@types/react",
    "@types/react-dom",
    "@testing-library/react",
    "@testing-library/jest-dom",
    "jsdom",
    "typescript",
    "vite",
    "vitest",
    "@vitejs/plugin-react",
  ]) {
    const manifest = JSON.parse(
      await readFile(join(root, "packages/editor/node_modules", name, "package.json"), "utf8"),
    );
    dependencies[name] = manifest.version;
  }
  for (const name of ["pg", "@types/pg"]) {
    const manifest = JSON.parse(
      await readFile(join(root, "packages/db/node_modules", name, "package.json"), "utf8"),
    );
    dependencies[name] = manifest.version;
  }
  const manifestPath = join(installed, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  await writeFile(
    manifestPath,
    JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, ...dependencies } }),
  );
}

export async function checkEditorAssets(installed) {
  const assets = join(installed, "dist/assets");
  const files = await readdir(assets);
  assert(
    files.some((file) => file.includes("read-docx.worker") && file.endsWith(".js")),
    "The installed consumer lost the DOCX worker",
  );
  const styles = files.filter((file) => file.endsWith(".css"));
  assert(styles.length > 0, "The installed consumer lost the stylesheet");
  const css = (await Promise.all(styles.map((file) => readFile(join(assets, file), "utf8")))).join(
    "",
  );
  assert(
    css.includes("--canvas") && css.includes(".bg-canvas"),
    "The published stylesheet has no compiled editor utilities",
  );
}
