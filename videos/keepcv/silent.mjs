import { spawn } from "node:child_process";
import "./finalize-audio.mjs";
import { cuts, directory } from "./output.mjs";

for (const { name } of cuts) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@remotion/cli/remotion-cli.js",
        "ffmpeg",
        "-y",
        "-i",
        `${directory}/${name}.mp4`,
        "-map",
        "0:v:0",
        "-vcodec",
        "copy",
        "-an",
        `${directory}/${name}-silent.mp4`,
      ],
      { stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Silent copy failed: ${code}`)),
    );
  });
}
