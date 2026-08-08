import { mkdirSync, writeFileSync } from "node:fs";
import { EXPORT_JSON_SCHEMA_FILE, exportJsonSchema } from "../dist/index.js";

const directory = new URL("../schema/", import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(
  new URL(EXPORT_JSON_SCHEMA_FILE, directory),
  `${JSON.stringify(exportJsonSchema, null, 2)}\n`,
);
