import { test } from "node:test";
import assert from "node:assert/strict";
import {
  profileIdentifier,
  lapTime,
  connectionState,
} from "../src/gt7-model.js";
import { normalizeDriver } from "../api/gt7-profile.js";
test("profile inputs only permit PSN handles and canonical GT7 URLs", () => {
  assert.equal(profileIdentifier("Example_PSN"), "Example_PSN");
  assert.equal(
    profileIdentifier(
      "https://www.gran-turismo.com/us/gt7/user/mymenu/00000000-0000-4000-8000-000000000001/profile",
    ),
    "00000000-0000-4000-8000-000000000001",
  );
  for (const value of [
    "http://127.0.0.1/",
    "https://gran-turismo.com.evil.test/us/gt7",
    "https://www.gran-turismo.com:999/profile",
    "https://user:pass@gran-turismo.com/us/gt7",
  ])
    assert.throws(() => profileIdentifier(value));
});
test("telemetry distinguishes stale, paused and simulated packets", () => {
  const now = Date.now();
  const status = {
    sample: { captured_at: now / 1000, on_track: true },
    source: "console",
  };
  assert.equal(connectionState(status, now), "Live");
  assert.equal(connectionState(status, now + 4000), "Signal lost");
  assert.equal(
    connectionState({ ...status, source: "simulation" }, now),
    "Simulation",
  );
  assert.equal(
    connectionState(
      { ...status, sample: { ...status.sample, paused: true } },
      now,
    ),
    "Paused",
  );
  assert.equal(lapTime(109800), "1:49.800");
});
test("provider data has explicit provenance and unavailable values remain null", () => {
  const p = normalizeDriver({
    PSN_ID: "Example",
    DR: "B",
    SR: "S",
    stats: { total_races: 10, victories: 0, garage_count: "unknown" },
  });
  assert.equal(p.source, "GT GridStats");
  assert.equal(p.stats.victories, 0);
  assert.equal(p.stats.garage_count, null);
});
