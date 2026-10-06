import { setTimeout, clearTimeout } from "node:timers";

/** Register before the fixture pool establishes any connections. */
export function trackPoolDisconnects(pool, timeoutMs = 12000) {
  const pending = new Map();
  pool.on("connect", (client) => {
    let resolve;
    const closed = new Promise((done) => {
      resolve = done;
    });
    pending.set(client, { closed, resolve });
  });
  pool.on("remove", (client) => {
    pending.get(client)?.resolve();
    pending.delete(client);
  });
  return async () => {
    let timer;
    try {
      await Promise.race([
        (async () => {
          // pg-pool resolves end() when its count reaches zero, before idle
          // clients' end callbacks emit remove. Wait for those callbacks too.
          await pool.end();
          await Promise.all([...pending.values()].map(({ closed }) => closed));
        })(),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            reject(
              Object.assign(new Error("Fixture pool disconnect timed out"), {
                code: "FIXTURE_POOL_DISCONNECT_TIMEOUT",
              }),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
