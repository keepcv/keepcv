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
  route: [25, 53, 67],
  assistantSetup: [25, 53, 69],
  layout: [25, 41, 57],
  finish: [25, 53, 89],
};
const chapterMoves = new Set(["route", "selection", "assistantSetup", "layout", "finish"]);
const recordedActions = {
  compose: [
    [1.4, "click"],
    [3.14, "click"],
  ],
  assistantJob: [
    [0.17, "key"],
    [1.7, "click"],
  ],
  assistantReview: [[2.35, "confirm"]],
  assistantManage: [[2.2, "confirm"]],
  assistantResult: [[0.65, "pop"]],
  reorder: [[2.6, "pop"]],
  journeyRecord: [[0.63, "click"]],
  journeyTemplates: [
    [1.5, "click"],
    [3.9, "click"],
    [6.27, "click"],
    [8.67, "click"],
  ],
  journeyApply: [
    [1.14, "click"],
    [1.9, "confirm"],
  ],
  journeyExport: [[1.53, "click"]],
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
  return (recordedActions[shot.name] ?? [])
    .filter(([seconds]) => seconds * 30 < shot.frames)
    .map(([seconds, type]) => ({
      at: shot.from / 30 + seconds,
      type,
      strength: type === "confirm" ? 1 : 1.25,
    }));
}
export function audioCues(cut) {
  return timeline(cut)
    .flatMap((shot) => [
      ...(chapterMoves.has(shot.topic)
        ? [{ at: shot.from / 30 - 0.15, type: "swish", strength: 0.45 }]
        : []),
      ...(shot.kind === "graphic" ? graphicCues(shot) : uiCues(shot)),
    ])
    .sort((a, b) => a.at - b.at);
}
