import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { setImmediate } from "node:timers/promises";
import { trackPoolDisconnects } from "./pool-disconnects.mjs";

const requireWeb = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { Pool } = requireWeb("pg");

// Use the installed real Pool implementation; only transport completion is
// controlled, reproducing a socket that has not acknowledged disconnect yet.
class DelayedClient extends EventEmitter {
  connect(callback) {
    callback();
  }
  end(callback) {
    this.endCallback = callback;
  }
  finishDisconnect() {
    this.endCallback();
  }
}

test("installed Pool.end resolves before an idle transport disconnects", async () => {
  const pool = new Pool({ Client: DelayedClient });
  const client = await pool.connect();
  client.release();
  let removed = false;
  pool.on("remove", () => {
    removed = true;
  });
  await pool.end();
  assert.equal(pool.totalCount, 0);
  assert.equal(removed, false);
  client.finishDisconnect();
  assert.equal(removed, true);
});

test("fixture shutdown waits for every idle client disconnect before cluster stop", async () => {
  const pool = new Pool({ Client: DelayedClient });
  const close = trackPoolDisconnects(pool);
  const first = await pool.connect();
  const second = await pool.connect();
  first.release();
  second.release();
  let clusterStopped = false;
  const stopping = close().then(() => {
    clusterStopped = true;
  });
  await setImmediate();
  assert.equal(pool.totalCount, 0);
  assert.equal(clusterStopped, false);
  first.finishDisconnect();
  await setImmediate();
  assert.equal(clusterStopped, false);
  second.finishDisconnect();
  await stopping;
  assert.equal(clusterStopped, true);
});

test("fixture shutdown has a finite disconnect deadline", async () => {
  const pool = new Pool({ Client: DelayedClient });
  const close = trackPoolDisconnects(pool, 20);
  const client = await pool.connect();
  client.release();
  await assert.rejects(close(), { code: "FIXTURE_POOL_DISCONNECT_TIMEOUT" });
  client.finishDisconnect();
});

test("fixture shutdown preserves a pool end failure", async () => {
  const pool = new Pool({ Client: DelayedClient });
  const failure = new Error("Pool lifecycle failure");
  pool.end = async () => {
    throw failure;
  };
  await assert.rejects(
    trackPoolDisconnects(pool)(),
    (error) => error === failure,
  );
});
