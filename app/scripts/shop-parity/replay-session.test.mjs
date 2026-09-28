import assert from "node:assert/strict";
import test from "node:test";
import {
  replayStartForFrame,
  canContinueReplay,
  closeCaptureSession,
} from "./run.mjs";

test("replay begins at the nearest explicit source entry", () => {
  const frames = [
    {},
    {},
    { entry: { scenario: "returning" } },
    {},
    { entry: { scenario: "other" } },
  ];
  assert.equal(replayStartForFrame(frames, 1), 0);
  assert.equal(replayStartForFrame(frames, 2), 0);
  assert.equal(replayStartForFrame(frames, 3), 2);
  assert.equal(replayStartForFrame(frames, 4), 2);
  assert.equal(replayStartForFrame(frames, 5), 4);
  for (const value of [0, -1, 6, 1.5, NaN])
    assert.throws(() => replayStartForFrame(frames, value), RangeError);
});

test("only consecutive frames in the same recorded entry share browser state", () => {
  const session = { flowNo: 45, replayStart: 1, nextFrameIndex: 3 };
  assert.equal(canContinueReplay(session, { flowNo: 45, frameNo: 4 }, 1), true);
  for (const [state, frame, entry] of [
    [null, { flowNo: 45, frameNo: 4 }, 1],
    [session, { flowNo: 46, frameNo: 4 }, 1],
    [session, { flowNo: 45, frameNo: 4 }, 3],
    [session, { flowNo: 45, frameNo: 5 }, 1],
    [session, { flowNo: 45, frameNo: 3 }, 1],
  ])
    assert.equal(canContinueReplay(state, frame, entry), false);
});

test("capture cleanup releases held requests before closing the context", async () => {
  const calls = [];
  await closeCaptureSession({
    loadingReplay: { dispose: async () => calls.push("dispose") },
    context: { close: async () => calls.push("close") },
  });
  assert.deepEqual(calls, ["dispose", "close"]);
});

test("a failed held-request cleanup cannot leak the browser context", async () => {
  let closed = false;
  await assert.rejects(
    closeCaptureSession({
      loadingReplay: {
        dispose: async () => {
          throw new Error("request disposed");
        },
      },
      context: {
        close: async () => {
          closed = true;
        },
      },
    }),
    /request disposed/,
  );
  assert.equal(closed, true);
});

test("a post-capture request release cannot be replayed twice in one context", () => {
  const session = {
    flowNo: 44,
    replayStart: 0,
    nextFrameIndex: 3,
    afterCaptureAdvanced: true,
  };
  assert.equal(
    canContinueReplay(session, { flowNo: 44, frameNo: 4 }, 0),
    false,
  );
  assert.equal(
    canContinueReplay(
      { ...session, afterCaptureAdvanced: false },
      { flowNo: 44, frameNo: 4 },
      0,
    ),
    true,
  );
});
