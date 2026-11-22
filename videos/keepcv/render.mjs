import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { cuts, directory, scale } from "./output.mjs";
import "./subtitles.mjs";

await mkdir(directory, { recursive: true });
for (const { composition, name } of cuts) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@remotion/cli/remotion-cli.js",
        "render",
        "videos/keepcv/index.jsx",
        composition,
        `${directory}/${name}.mp4`,
        "--public-dir=videos/keepcv/public",
        "--codec=h264",
        "--crf=18",
        `--scale=${scale}`,
        "--muted",
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
