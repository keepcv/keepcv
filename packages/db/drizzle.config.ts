import { defineConfig } from "drizzle-kit";

// `generate` only, never `push`: a schema diff applied straight to a database
// skips the expand/contract review.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});
