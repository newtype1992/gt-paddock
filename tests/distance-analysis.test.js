import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distanceLap,
  compareDistance,
  atDistance,
} from "../src/distance-analysis.js";
function lap(seconds, speed) {
  return {
    complete: true,
    points: Array.from({ length: seconds * 10 }, (_, i) => ({
      elapsed: i / 10,
      speed,
      rpm: 5000,
      throttle: 90,
      brake: 0,
      gear: 4,
    })),
  };
}
test("integrates km/h into metres and aligns slower equal-length laps", () => {
  const a = distanceLap(lap(10, 72), 10000),
    b = distanceLap(lap(20, 36), 20000);
  assert.ok(Math.abs(a.length - 200) < 0.001);
  assert.ok(Math.abs(b.length - 200) < 0.001);
  assert.ok(Math.abs(atDistance(a.points, 100).elapsed - 5) < 0.001);
  const result = compareDistance(a, b);
  assert.ok(Math.abs(result.deltas.at(-1).delta - 10) < 0.001);
  assert.ok(result.focus.loss > 0);
});
test("refuses partial, gapped and mismatched lap distances", () => {
  assert.ok(distanceLap({ ...lap(10, 72), complete: false }, 10000).error);
  const gapped = lap(10, 72);
  gapped.points.splice(10, 20);
  assert.ok(distanceLap(gapped, 10000).error);
  assert.ok(
    compareDistance(
      distanceLap(lap(10, 72), 10000),
      distanceLap(lap(10, 90), 10000),
    ).error,
  );
});
test("does not identify a loss when laps match", () => {
  const a = distanceLap(lap(10, 72), 10000);
  assert.equal(compareDistance(a, a).focus, null);
  assert.equal(atDistance(a.points, 1000), null);
});
