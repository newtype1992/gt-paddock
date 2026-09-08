import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trackLabel,
  trackKey,
  multiplier,
  sessionSettings,
} from "../src/session-context.js";
test("track identity keeps variations and direction separate", () => {
  const base = {
    track: "Trial Mountain",
    layout: "Full",
    direction: "Forward",
  };
  assert.equal(trackLabel(base), "Trial Mountain / Full / Forward");
  assert.notEqual(trackKey(base), trackKey({ ...base, direction: "Reverse" }));
  assert.notEqual(trackKey(base), trackKey({ ...base, layout: "Short" }));
  assert.equal(trackKey({}), null);
});
test("unknown settings do not become zero and zero is preserved", () => {
  assert.equal(multiplier(""), null);
  assert.equal(multiplier("0"), 0);
  assert.equal(multiplier("3"), 3);
  assert.throws(() => multiplier("-1"));
  assert.throws(() => multiplier("abc"));
  assert.equal(sessionSettings({})[1][1], "Unknown");
  assert.equal(sessionSettings({ fuelMultiplier: 0 })[1][1], "0x");
});
