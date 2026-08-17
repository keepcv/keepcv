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
  // The launcher serves both from one origin, so the dev server reproduces that
  // rather than teaching the app a second base URL.
  server: { proxy: { "/v1": "http://127.0.0.1:4319" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
