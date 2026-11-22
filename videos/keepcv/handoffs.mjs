import { easeBetween, SOURCE_HEIGHT, SOURCE_WIDTH, stageAt } from "./motion.mjs";

export const handoffHalf = 12;
export const handoffTail = 6;
const stage = stageAt();
const viewport = [
  stage.left,
  stage.top,
  SOURCE_WIDTH * stage.scale,
  SOURCE_HEIGHT * stage.scale,
  17,
];
const panels = {
  opening: [1460, 260, 342, 497, 16],
  store: [220, 355, 658, 498, 22],
  records: [300, 325, 410, 210, 24],
  wording: [350, 305, 998, 213, 22],
  evidence: [270, 340, 618, 488, 22],
  find: [330, 300, 1318, 203, 22],
  selection: [200, 305, 698, 568, 22],
  reorder: [420, 285, 1080, 610, 24],
  design: [230, 340, 558, 483, 22],
  fit: [340, 290, 580, 610, 24],
  portable: [824, 379, 338, 437, 12],
  history: [210, 360, 233, 301, 12],
  assistantResume: [1015, 322, 715, 545, 24],
  recovery: [1080, 370, 510, 410, 24],
  closing: [665, 300, 590, 125, 28],
  intake: [920, 310, 750, 600, 24],
  profile: [450, 320, 1000, 515, 24],
  context: [290, 310, 1340, 540, 24],
  search: [350, 310, 1220, 120, 24],
  roles: [270, 330, 500, 470, 24],
  target: [250, 310, 678, 568, 22],
  builder: [1120, 305, 500, 560, 24],
  html: [1120, 305, 500, 560, 24],
};

export function panelFor(shot, entering = false) {
  if (entering && shot.topic === "records") return [750, 450, 410, 210, 24];
  if (entering && shot.topic === "profile") return [300, 320, 1000, 515, 24];
  return shot.kind === "ui" ? viewport : panels[shot.topic];
}

export function handoffAt(from, to, frame) {
  const p = easeBetween(frame, -handoffHalf, handoffHalf);
  const source = panelFor(from);
  const target = panelFor(to, true);
  const shape = source.map((value, i) => value + (target[i] - value) * p);
  // Keep a travelling panel below the heading and assistant disclosure.
  const clearance = Math.max(0, shape[1] - 285);
  const lift = Math.min(95, Math.abs(target[0] - source[0]) * 0.12, clearance);
  shape[1] -= lift * Math.sin(p * Math.PI);
  return shape;
}
