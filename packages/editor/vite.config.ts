import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import manifest from "./package.json" with { type: "json" };

const external = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies });

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    cssCodeSplit: true,
    emptyOutDir: false,
    lib: {
      entry: { index: "src/index.tsx", ui: "src/ui.ts", style: "src/styles/app.css" },
      formats: ["es"],
      cssFileName: "style",
    },
    rollupOptions: {
      external: (id) => external.some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
  test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"], testTimeout: 10_000 },
});
