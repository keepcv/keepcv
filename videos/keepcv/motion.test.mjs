import assert from "node:assert/strict";
import test from "node:test";
import { handoffAt, handoffHalf, panelFor } from "./handoffs.mjs";
import { SOURCE_HEIGHT, SOURCE_WIDTH, stageAt } from "./motion.mjs";
import { timeline } from "./timeline.mjs";

test("the entire recorded viewport stays inside both the stage and output", () => {
  const stage = stageAt();
  assert(stage.left >= 0 && stage.top >= 0);
  assert(stage.left + SOURCE_WIDTH * stage.scale <= 1920);
  assert(stage.top + SOURCE_HEIGHT * stage.scale <= 1080);
  assert.equal(SOURCE_WIDTH / SOURCE_HEIGHT, 16 / 9);
});

test("both cuts reserve exactly forty percent for application UI", () => {
  for (const [cut, total] of [
    ["short", 2700],
    ["long", 5400],
  ]) {
    const shots = timeline(cut);
    assert.equal(
      shots.reduce((sum, shot) => sum + shot.frames, 0),
      total,
    );
    assert.equal(
      shots.filter((shot) => shot.kind === "ui").reduce((sum, shot) => sum + shot.frames, 0),
      total * 0.4,
    );
    assert.equal(
      shots.filter((shot) => shot.kind === "graphic").reduce((sum, shot) => sum + shot.frames, 0),
      total * 0.6,
    );
    const assistant = shots.filter((shot) => (shot.name ?? shot.topic).startsWith("assistant"));
    assert.deepEqual(
      assistant.map((shot) => shot.name ?? shot.topic),
      [
        ...(cut === "long" ? ["assistantManage"] : []),
        "assistantJob",
        "assistantReview",
        "assistantResume",
        "assistantResult",
      ],
    );
    assert(assistant[0].from < 360);
    assert.equal(assistant.filter((shot) => shot.kind === "graphic").length, 1);
    assert(shots.some((shot) => shot.topic === "recovery"));
    for (let i = 1; i < shots.length; i++)
      assert.equal(shots[i].from, shots[i - 1].from + shots[i - 1].frames);
  }
});

test("each shared panel joins its two shots and travels entirely inside the stage", () => {
  for (const cut of ["short", "long"]) {
    const shots = timeline(cut);
    for (const [index, from] of shots.slice(0, -1).entries()) {
      const to = shots[index + 1];
      assert.deepEqual(handoffAt(from, to, -handoffHalf), panelFor(from));
      assert.deepEqual(handoffAt(from, to, handoffHalf), panelFor(to, true));
      for (let frame = -handoffHalf; frame <= handoffHalf; frame++) {
        const [x, y, w, h] = handoffAt(from, to, frame);
        assert(x >= 0 && y >= 0 && w > 0 && h > 0);
        assert(x + w <= 1920 && y + h <= 1080);
      }
    }
  }
});
