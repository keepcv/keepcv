import { spawn } from "node:child_process";
import "./finalize-audio.mjs";

for (const name of ["keepcv-90s", "keepcv-3min"]) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@remotion/cli/remotion-cli.js",
        "ffmpeg",
        "-y",
        "-i",
        `.keepcv-promo/deliverables/${name}-4k.mp4`,
        "-map",
        "0:v:0",
        "-vcodec",
        "copy",
        "-an",
        `.keepcv-promo/deliverables/${name}-4k-silent.mp4`,
      ],
      { stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Silent copy failed: ${code}`)),
    );
  });
}
