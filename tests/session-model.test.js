import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bestLap,
  mergeFinishedSession,
  lapSamples,
  sessionTotals,
  tracePath,
} from "../src/session-model.js";
test("finished snapshots bridge stale lists without duplicates or losing notes", () => {
  const old = { id: 'old', started_at: 1 };
  const finished = { id: 'new', started_at: 2, ended_at: 3, laps: [{ lap: 1, time_ms: 90000 }] };
  const initial = mergeFinishedSession([old], finished);
  assert.deepEqual(initial, [finished, old]);
  const annotated = [{ ...finished, annotation: { track: 'Trial Mountain' } }, old];
  const stale = mergeFinishedSession([old], finished, annotated);
  assert.deepEqual(stale, annotated);
  const refreshed = mergeFinishedSession([{ ...finished, laps: [], annotation: { track: 'Spa' } }, old], finished, annotated);
  assert.equal(refreshed.length, 2);
  assert.deepEqual(refreshed[0].laps, finished.laps);
  assert.equal(refreshed[0].annotation.track, 'Spa');
  assert.deepEqual(mergeFinishedSession([old], null), [old]);
  assert.deepEqual(mergeFinishedSession([old], { id: 'active' }), [old]);
});
test("summary only aggregates valid completed laps", () => {
  const s = {
    car_id: 82,
    laps: [
      { lap: 1, time_ms: 78126 },
      { lap: 2, time_ms: 96131 },
      { lap: 3, time_ms: null },
    ],
  };
  assert.equal(bestLap(s), 78126);
  assert.deepEqual(sessionTotals([s]), {
    sessions: 1,
    cars: 1,
    laps: 2,
    lapSeconds: 174.257,
  });
  assert.equal(bestLap({ laps: [] }), null);
});
test("elapsed alignment preserves partial start instead of stretching a lap", () => {
  const raw = [
    { lap: 1, captured_at: 105, speed: 100 },
    { lap: 1, captured_at: 109.9, speed: 110 },
    { lap: 2, captured_at: 110 },
  ];
  const result = lapSamples(raw, { lap: 1, time_ms: 10000 });
  assert.equal(result.points[0].elapsed, 5);
  assert.equal(result.complete, false);
  assert.equal(
    (tracePath(result.points, "speed", 10, 320).match(/M/g) || []).length,
    2,
  );
});
test("requires finish boundary and handles complete sample coverage", () => {
  const samples = Array.from({ length: 100 }, (_, i) => ({
    lap: 1,
    captured_at: 100 + i / 10,
  }));
  assert.equal(
    lapSamples(samples, { lap: 1, time_ms: 10000 }).points.length,
    0,
  );
  samples.push({ lap: 2, captured_at: 110 });
  assert.equal(lapSamples(samples, { lap: 1, time_ms: 10000 }).complete, true);
});
