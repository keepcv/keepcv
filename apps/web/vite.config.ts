import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
// From vitest rather than vite, so the build config and the test config are one
// file and cannot describe different module resolution.
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Served from the launcher's own origin, alongside /v1, so the app never needs
  // to know where it was deployed.
  base: "/",
  build: { outDir: "dist", emptyOutDir: true },
  // In production the launcher serves both from one origin. The dev server has
  // to reproduce that rather than let the app learn a second base URL, which
  // would be a code path only development ever takes.
  server: { proxy: { "/v1": "http://127.0.0.1:4319" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
