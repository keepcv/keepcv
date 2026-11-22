import { mkdir, writeFile } from "node:fs/promises";
import { graphicCopy } from "./graphics-copy.mjs";
import { cuts, directory } from "./output.mjs";
import { scenes } from "./story.mjs";
import { timeline } from "./timeline.mjs";

const stamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
await mkdir(directory, { recursive: true });
for (const { name, cut } of cuts) {
  const captions = timeline(cut).map((shot) => {
    const text =
      shot.kind === "ui"
        ? scenes[shot.name]
        : shot.topic === "opening"
          ? ["KeepCV. Your career is bigger than one page."]
          : shot.topic === "closing"
            ? ["KeepCV. Write it once. Never lose it.", "github.com/keepcv/keepcv"]
            : graphicCopy[shot.topic];
    return [shot.from / 30, (shot.from + shot.frames) / 30, text.slice(0, 2).join("\n")];
  });
  await writeFile(
    `${directory}/${name}.srt`,
    captions
      .map(([from, to, text], i) => `${i + 1}\n${stamp(from)} --> ${stamp(to)}\n${text}\n`)
      .join("\n"),
  );
}
