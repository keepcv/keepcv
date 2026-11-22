import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import "./subtitles.mjs";

await mkdir(".keepcv-promo/deliverables", { recursive: true });
for (const [composition, name] of [
  ["KeepCV90", "keepcv-90s"],
  ["KeepCV180", "keepcv-3min"],
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@remotion/cli/remotion-cli.js",
        "render",
        "videos/keepcv/index.jsx",
        composition,
        `.keepcv-promo/deliverables/${name}-4k.mp4`,
        "--public-dir=videos/keepcv/public",
        "--codec=h264",
        "--crf=18",
        "--scale=2",
        "--concurrency=6",
      ],
      { stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Render failed: ${code}`)),
    );
  });
}
await import("./silent.mjs");
