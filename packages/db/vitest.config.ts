import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Parallel large fixtures exhausted recovery's acquisition deadline.
  test: { maxWorkers: Math.min(4, availableParallelism()) },
});
