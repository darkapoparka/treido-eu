import assert from "node:assert/strict";
import { test } from "vitest";
import { jeansProgressAt } from "./search-progress";

test("captured Jeans progress follows the recording and ends at ten seconds", () => {
  const start = 1_000_000;
  const samples = [
    [0, "thinking"],
    [2599, "thinking"],
    [2600, "researching"],
    [4600, "browsing"],
    [6600, "comparing"],
    [8600, "finishing"],
    [9999, "finishing"],
    [10000, undefined],
    [60000, undefined],
  ] as const;
  for (const [elapsed, phase] of samples)
    assert.equal(jeansProgressAt(start, start + elapsed)?.id, phase);
});

test("invalid or future progress markers cannot start a captured preview", () => {
  for (const start of [0, -1, NaN, Infinity, 2000])
    assert.equal(jeansProgressAt(start, 1000), null);
});
