import { timeline } from "./timeline.mjs";

const graphicActions = {
  store: [10, 30, 50, 70, 90],
  records: [15, 35, 60, 90],
  wording: [12, 38, 64],
  evidence: [25, 58, 110],
  find: [35, 70, 105],
  roles: [50, 100],
  selection: [55, 75, 95],
  reorder: [25, 85],
  target: [22, 46, 70, 94],
  design: [38, 76, 114],
  builder: [25, 59, 93],
  html: [17, 51, 85],
  fit: [30, 75, 125],
  portable: [20, 38, 56, 74],
  history: [22, 44, 66],
  intake: [38, 66, 94, 125],
  profile: [35, 59, 83, 120],
  context: [37, 74, 111],
  search: [35, 90, 135],
  recovery: [15, 55, 95, 130],
  assistantResume: [24, 44, 63],
};
function graphicCues(shot) {
  const cues = [];
  const start = shot.from / 30;
  const add = (at, type, strength = 1) => cues.push({ at, type, strength });
  for (const [i, frame] of (graphicActions[shot.topic] ?? []).entries()) {
    add(start + ((frame / 150) * shot.frames) / 30, i % 3 === 2 ? "chime" : "pop", 0.65);
  }
  if (shot.topic === "closing") add(start + 0.8, "confirm", 0.7);
  return cues;
}
function uiCues(shot) {
  const cues = [];
  const start = shot.from / 30;
  const add = (at, type, strength = 1) => cues.push({ at, type, strength });
  if (shot.name === "compose") {
    add(start + 0.9, "click", 0.7);
    add(start + (4.7 - 50 / 30) / 1.6, "click", 0.7);
  }
  if (shot.name === "export") add(start + (6.6 - 65 / 30) / 1.6, "confirm", 0.8);
  if (shot.name === "assistantJob") {
    add(start + 0.17, "key", 0.6);
    add(start + 1.7, "click", 0.6);
  }
  if (shot.name === "assistantReview") add(start + 2.35, "confirm", 0.8);
  if (shot.name === "assistantManage") add(start + 2.43, "confirm", 0.8);
  if (shot.name === "assistantResult") add(start + 0.65, "pop", 0.55);
  if (shot.name === "reorder") add(start + 2.6, "pop", 0.7);
  if (shot.name === "search")
    for (let i = 0; i < 10; i++) add(start + 0.65 + i * 0.14, "key", 0.45);
  return cues;
}
export function audioCues(cut) {
  return timeline(cut)
    .flatMap((shot) => [
      ...(shot.from > 0 ? [{ at: shot.from / 30 - 0.15, type: "swish", strength: 0.5 }] : []),
      ...(shot.kind === "graphic" ? graphicCues(shot) : uiCues(shot)),
    ])
    .sort((a, b) => a.at - b.at);
}
