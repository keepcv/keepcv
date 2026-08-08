import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only, never `push`: migrations are reviewed for
// expand/contract compliance before they run, and a schema diff applied
// straight to a database skips that review.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});
