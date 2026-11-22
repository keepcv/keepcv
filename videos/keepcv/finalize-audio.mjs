import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";
import { cuts, directory } from "./output.mjs";
import "./score.mjs";

async function remux(master, audio, output) {
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@remotion/cli/remotion-cli.js",
        "ffmpeg",
        "-y",
        "-i",
        master,
        "-i",
        audio,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vcodec",
        "copy",
        "-acodec",
        "aac",
        "-ab",
        "192k",
        "-movflags",
        "+faststart",
        "-shortest",
        output,
      ],
      { stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Soundtrack mix failed: ${code}`)),
    );
  });
}
for (const { name, cut } of cuts) {
  const master = `${directory}/${name}.mp4`;
  const updated = `${directory}/${name}-audio.mp4`;
  await remux(master, `videos/keepcv/public/audio/mix-${cut}.wav`, updated);
  await rename(updated, master);
  await remux(
    master,
    `videos/keepcv/public/audio/effects-${cut}.wav`,
    `${directory}/${name}-effects-only.mp4`,
  );
}
