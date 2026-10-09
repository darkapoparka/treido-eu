import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { setImmediate } from "node:timers/promises";
import path from "node:path";
import { trackPoolDisconnects } from "./pool-disconnects.mjs";
import {
  assertFixtureHeadroom,
  cleanupLaunchCluster,
  rethrowLaunchFailure,
  selectFixtureEvidenceDirectory,
} from "./native-fixture-support.mjs";

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

test("fixture cleanup attempts every drain and owned stop after disconnect failures", async () => {
  const first = new Error("First disconnect failed");
  const second = new Error("Second disconnect failed");
  const calls = [];
  let stopped = false;
  await assert.rejects(
    cleanupLaunchCluster({
      drains: [
        async () => {
          calls.push("runtime");
          throw first;
        },
        async () => {
          calls.push("admin");
          throw second;
        },
        async () => calls.push("bootstrap"),
      ],
      stop: async () => calls.push("pg_ctl"),
      recordStopped: async () => {
        stopped = true;
        calls.push("persist");
      },
    }),
    (error) =>
      error instanceof AggregateError &&
      error.errors.length === 2 &&
      error.errors[0] === first &&
      error.errors[1] === second,
  );
  assert.deepEqual(calls, [
    "runtime",
    "admin",
    "bootstrap",
    "pg_ctl",
    "persist",
  ]);
  assert.equal(stopped, true);
});

test("fixture cleanup preserves drain and stop failures without recording stopped", async () => {
  const disconnectFailure = new Error("Disconnect failed");
  const stopFailure = new Error("Owned stop failed");
  const calls = [];
  let stopped = false;
  await assert.rejects(
    cleanupLaunchCluster({
      drains: [
        async () => {
          calls.push("runtime");
          throw disconnectFailure;
        },
        async () => calls.push("bootstrap"),
      ],
      stop: async () => {
        calls.push("pg_ctl");
        throw stopFailure;
      },
      recordStopped: async () => {
        stopped = true;
      },
    }),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === disconnectFailure &&
      error.errors[1] === stopFailure,
  );
  assert.deepEqual(calls, ["runtime", "bootstrap", "pg_ctl"]);
  assert.equal(stopped, false);
});

test("fixture cleanup keeps successful stop fact when persistence fails", async () => {
  const persistenceFailure = new Error("State write failed");
  let stopped = false;
  await assert.rejects(
    cleanupLaunchCluster({
      drains: [],
      stop: async () => {},
      recordStopped: async () => {
        stopped = true;
        throw persistenceFailure;
      },
    }),
    (error) => error === persistenceFailure,
  );
  assert.equal(stopped, true);
});

test("fixture cleanup does not record an unstarted cluster as stopped", async () => {
  let drained = false;
  let stopped = false;
  await cleanupLaunchCluster({
    drains: [
      async () => {
        drained = true;
      },
    ],
    recordStopped: async () => {
      stopped = true;
    },
  });
  assert.equal(drained, true);
  assert.equal(stopped, false);
});

test("fixture startup retains original and all cleanup failures", async () => {
  const startupFailure = new Error("Migration failed");
  const disconnectFailure = new Error("Disconnect failed");
  const stopFailure = new Error("Owned stop failed");
  await assert.rejects(
    rethrowLaunchFailure(startupFailure, () =>
      cleanupLaunchCluster({
        drains: [
          async () => {
            throw disconnectFailure;
          },
        ],
        stop: async () => {
          throw stopFailure;
        },
        recordStopped: async () =>
          assert.fail("Failed stop cannot be persisted"),
      }),
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === startupFailure &&
      error.errors[1] instanceof AggregateError &&
      error.errors[1].errors[0] === disconnectFailure &&
      error.errors[1].errors[1] === stopFailure,
  );
});

test("fixture startup preserves original failure after successful cleanup", async () => {
  const startupFailure = new Error("Migration failed");
  let cleaned = false;
  await assert.rejects(
    rethrowLaunchFailure(startupFailure, async () => {
      cleaned = true;
    }),
    (error) => error === startupFailure,
  );
  assert.equal(cleaned, true);
});

test("fixture evidence keeps ordinary default and honors explicit path before environment", () => {
  const ordinary = path.resolve("fixture-default");
  const environment = path.resolve("fixture-environment");
  const requested = path.resolve("fixture-requested");
  assert.equal(
    selectFixtureEvidenceDirectory(undefined, undefined, ordinary),
    ordinary,
  );
  assert.equal(
    selectFixtureEvidenceDirectory(undefined, environment, ordinary),
    environment,
  );
  assert.equal(
    selectFixtureEvidenceDirectory(requested, environment, ordinary),
    requested,
  );
});

test("fixture evidence rejects empty, relative, root and ambiguous explicit paths", () => {
  const ordinary = path.resolve("fixture-default");
  for (const invalid of [
    "",
    " ",
    ".",
    "relative/path",
    path.parse(ordinary).root,
    path.join(path.parse(ordinary).root, "child", ".."),
    null,
    "C:relative",
    ` ${ordinary}`,
    `${ordinary}\0child`,
  ]) {
    assert.throws(
      () => selectFixtureEvidenceDirectory(invalid, undefined, ordinary),
      /absolute non-root path/,
    );
  }
  assert.throws(
    () => selectFixtureEvidenceDirectory(undefined, "", ordinary),
    /absolute non-root path/,
  );
  if (path.sep === "\\") {
    for (const ambiguous of ["\\relative-to-drive", "/relative-to-drive"])
      assert.throws(
        () => selectFixtureEvidenceDirectory(ambiguous, undefined, ordinary),
        /absolute non-root path/,
      );
  }
});

test("fixture headroom checks chosen filesystem at nearest existing ancestor", () => {
  const existing = path.resolve("fixture-evidence-volume");
  const evidence = path.join(existing, "missing", "native");
  const checked = [];
  assertFixtureHeadroom(evidence, {
    filesystem: (candidate) => {
      checked.push(candidate);
      if (candidate !== existing)
        throw Object.assign(new Error("Missing ancestor"), { code: "ENOENT" });
      return { bavail: 1073741824, bsize: 1 };
    },
    freeMemory: () => 1610612736,
  });
  assert.deepEqual(checked, [evidence, path.dirname(evidence), existing]);
});

test("fixture headroom rejects insufficient selected disk or unchanged RAM threshold", () => {
  const evidence = path.resolve("fixture-evidence-volume");
  assert.throws(
    () =>
      assertFixtureHeadroom(evidence, {
        filesystem: () => ({ bavail: 1073741823, bsize: 1 }),
        freeMemory: () => 1610612736,
      }),
    /Insufficient headroom/,
  );
  assert.throws(
    () =>
      assertFixtureHeadroom(evidence, {
        filesystem: () => ({ bavail: 1073741824, bsize: 1 }),
        freeMemory: () => 1610612735,
      }),
    /Insufficient headroom/,
  );
});

test("fixture headroom preserves filesystem failures instead of selecting another volume", () => {
  const evidence = path.resolve("fixture-evidence-volume");
  const failure = Object.assign(new Error("Filesystem denied"), {
    code: "EACCES",
  });
  assert.throws(
    () =>
      assertFixtureHeadroom(evidence, {
        filesystem: () => {
          throw failure;
        },
        freeMemory: () => 1610612736,
      }),
    (error) => error === failure,
  );
});
