import { longOrder, shortOrder } from "./story.mjs";

const assistantShots = [
  ["assistantManage", 0, 120],
  ["assistantJob", 72, 105],
  ["assistantReview", 90, 123],
  ["assistantResume", 102, 120],
  ["assistantResult", 48, 84],
];

const graphicsOnly = {
  short: new Set(["records", "history"]),
  long: new Set(["profile", "records", "record", "roles"]),
};
const shorterShortClips = new Set(["overview", "templates", "backup"]);

const shortGraphics = {
  overview: "store",
  records: "records",
  wording: "wording",
  evidence: "evidence",
  search: "find",
  compose: "selection",
  reorder: "reorder",
  templates: "design",
  design: "fit",
  export: "portable",
  history: "history",
  backup: "recovery",
};
const longGraphics = {
  overview: "store",
  import: "intake",
  profile: "profile",
  records: "records",
  record: "context",
  wording: "wording",
  evidence: "evidence",
  tags: "find",
  search: "search",
  roles: "roles",
  compose: "selection",
  reorder: "reorder",
  target: "target",
  templates: "design",
  builder: "builder",
  html: "html",
  design: "fit",
  export: "portable",
  history: "history",
  backup: "recovery",
};

function featureShots(name, long) {
  const cut = long ? "long" : "short";
  const graphics = long ? longGraphics : shortGraphics;
  const graphicFrames = long ? 147 : name === "overview" ? 117 : 111;
  const graphic = { kind: "graphic", topic: graphics[name], frames: graphicFrames };
  if (graphicsOnly[cut].has(name)) return [graphic];
  const uiFrames = long ? 108 : shorterShortClips.has(name) ? 80 : 90;
  return [graphic, { kind: "ui", name, frames: uiFrames }];
}

function assistantSequence(long) {
  return assistantShots.flatMap(([name, shortFrames, longFrames]) => {
    const frames = long ? longFrames : shortFrames;
    if (!frames) return [];
    return name === "assistantResume"
      ? [{ kind: "graphic", topic: name, frames }]
      : [{ kind: "ui", name, frames }];
  });
}

export function timeline(cut) {
  const long = cut === "long";
  const order = long ? longOrder : shortOrder;
  const features = order.flatMap((name) => [
    ...featureShots(name, long),
    ...(name === "overview" ? assistantSequence(long) : []),
  ]);
  let from = 0;
  return [
    { kind: "graphic", topic: "opening", frames: 90 },
    ...features,
    { kind: "graphic", topic: "closing", frames: 90 },
  ].map((shot) => {
    const timed = { ...shot, from };
    from += shot.frames;
    return timed;
  });
}
