import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyAxis,
  shouldCommitSwipe,
  swipeDirection,
  AXIS_RATIO,
  FLICK_SPEED_PX_MS,
} from "./gestures.ts";

test("classifyAxis: horizontal needs to clearly beat vertical", () => {
  // 100 lateral vs 20 vertical (> 1.2 ratio) → horizontal.
  assert.equal(classifyAxis(100, 20), "horizontal");
  // The exact ratio boundary is NOT enough (spec: ~1.2, clearly beyond).
  assert.equal(classifyAxis(120, 100), "ambiguous");
  // Vertical dominance locks the other way.
  assert.equal(classifyAxis(20, 100), "vertical");
});

test("classifyAxis: short ambiguous gestures never commit an axis", () => {
  assert.equal(classifyAxis(5, 5), "ambiguous");
  assert.equal(classifyAxis(0, 0), "ambiguous");
});

test("classifyAxis: respects a custom minimum distance", () => {
  // 15 px lateral vs 5 px vertical would be horizontal past the default
  // minimum, but under a stricter engagement distance it stays ambiguous.
  assert.equal(classifyAxis(15, 5, 20), "ambiguous");
  assert.equal(classifyAxis(30, 5, 20), "horizontal");
  assert.ok(AXIS_RATIO > 1);
});

test("shouldCommitSwipe: travel past threshold or a quick flick", () => {
  assert.equal(shouldCommitSwipe(60, 0.1, 56), true);
  assert.equal(shouldCommitSwipe(30, 0.1, 56), false);
  // Short but fast = intentional flick.
  assert.equal(shouldCommitSwipe(30, FLICK_SPEED_PX_MS + 0.1, 56), true);
  // Negative direction commits by magnitude.
  assert.equal(shouldCommitSwipe(-60, 0, 56), true);
});

test("swipeDirection: resolves by distance, or by velocity on flicks", () => {
  assert.equal(swipeDirection(-80, 0.2), -1);
  assert.equal(swipeDirection(80, 0.2), 1);
  // Fast flick wins even below the distance floor.
  assert.equal(swipeDirection(-10, -0.8), -1);
  // Nothing moves without distance or speed.
  assert.equal(swipeDirection(3, 0.05), 0);
});
