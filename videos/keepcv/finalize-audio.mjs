import { spawn } from "node:child_process";
import { rename } from "node:fs/promises";
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
for (const [name, cut] of [
  ["keepcv-90s", "short"],
  ["keepcv-3min", "long"],
]) {
  const master = `.keepcv-promo/deliverables/${name}-4k.mp4`;
  const updated = `.keepcv-promo/deliverables/${name}-audio.mp4`;
  await remux(master, `videos/keepcv/public/audio/mix-${cut}.wav`, updated);
  await rename(updated, master);
  await remux(
    master,
    `videos/keepcv/public/audio/effects-${cut}.wav`,
    `.keepcv-promo/deliverables/${name}-4k-effects-only.mp4`,
  );
}
