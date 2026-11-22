const graphic = (topic, seconds) => ({ kind: "graphic", topic, frames: seconds * 30 });
const ui = (name, seconds) => ({ kind: "ui", name, frames: seconds * 30 });

const short = [
  graphic("opening", 4),
  graphic("route", 5),
  ui("overview", 3),
  graphic("profile", 6),
  ui("journeyRecord", 4),
  graphic("wording", 7),
  graphic("selection", 7),
  ui("compose", 5),
  graphic("assistantSetup", 5),
  ui("assistantJob", 3.5),
  ui("assistantReview", 4),
  graphic("assistantResume", 5),
  ui("assistantResult", 3),
  graphic("layout", 5),
  ui("journeyTemplates", 6),
  ui("journeyApply", 3),
  graphic("finish", 6),
  ui("journeyExport", 4.5),
  graphic("closing", 4),
];

const long = [
  graphic("opening", 4),
  graphic("route", 6),
  ui("overview", 3),
  graphic("profile", 6),
  ui("profile", 4),
  graphic("intake", 5),
  ui("import", 3),
  graphic("store", 6),
  ui("journeyRecord", 4),
  graphic("wording", 6),
  graphic("evidence", 5),
  graphic("find", 5),
  graphic("roles", 5),
  graphic("selection", 7),
  ui("compose", 5),
  graphic("reorder", 5),
  ui("reorder", 4),
  graphic("target", 6),
  ui("target", 4),
  graphic("assistantSetup", 5),
  ui("assistantManage", 4),
  ui("assistantJob", 4),
  ui("assistantReview", 4.5),
  graphic("assistantResume", 6),
  ui("assistantResult", 3),
  graphic("layout", 5),
  ui("journeyTemplates", 9.5),
  ui("journeyApply", 3.5),
  graphic("builder", 6),
  ui("builder", 5),
  graphic("fit", 4),
  ui("design", 3),
  graphic("finish", 6),
  ui("journeyExport", 5),
  graphic("history", 5),
  ui("history", 3.5),
  graphic("closing", 5),
];

export function timeline(cut) {
  let from = 0;
  return (cut === "long" ? long : short).map((shot) => {
    const timed = { ...shot, from };
    from += shot.frames;
    return timed;
  });
}
