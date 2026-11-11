import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

await copyFile(
  fileURLToPath(import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")),
  new URL("../dist/pdf.worker.mjs", import.meta.url),
);
