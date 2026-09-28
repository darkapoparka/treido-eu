// Keep loading capture at the real request boundary. This helper neither
// substitutes responses nor changes the app DOM or comparison pixels.
export function createLoadingReplay(page, baseURL) {
  const origin = new URL(baseURL).origin;
  let held;
  let delayed;

  function target(value) {
    if (!value.startsWith("/") || value.startsWith("//"))
      throw new Error("Loading replay must target a local route");
    const url = new URL(value, origin);
    if (url.origin !== origin || url.hash)
      throw new Error("Loading replay must target the owned origin");
    url.searchParams.delete("_rsc");
    url.searchParams.sort();
    return `${url.pathname}?${url.searchParams}`;
  }
  function matches(request, expected) {
    const url = new URL(request.url());
    return (
      url.origin === origin &&
      request.method() === "GET" &&
      request.headers().rsc === "1" &&
      target(`${url.pathname}${url.search}`) === expected
    );
  }
  function signal() {
    let resolve;
    const promise = new Promise((done) => (resolve = done));
    return { promise, resolve };
  }
  async function observed(entry, description) {
    if (!entry) throw new Error(`${description} has not been armed`);
    let timeout;
    try {
      await Promise.race([
        entry.hit.promise,
        new Promise((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(`${description} did not intercept an RSC request`),
              ),
            10_000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  const handler = async (route) => {
    const request = route.request();
    if (held && matches(request, held.target)) {
      held.routes.push(route);
      held.hit.resolve();
      return;
    }
    if (delayed && !delayed.used && matches(request, delayed.target)) {
      delayed.used = true;
      delayed.hit.resolve();
      await route.fallback({
        headers: {
          ...request.headers(),
          "x-shop-reference-catalog-delay-ms": String(delayed.ms),
        },
      });
      return;
    }
    // Preserve the runner's context-level same-origin allowlist.
    await route.fallback();
  };

  return {
    install: () => page.route("**/*", handler),
    holdRsc(url) {
      if (held) throw new Error("A loading RSC hold is already active");
      held = { target: target(url), routes: [], hit: signal() };
    },
    waitRsc: () => observed(held, "Loading RSC hold"),
    async releaseRsc() {
      await observed(held, "Loading RSC hold");
      const routes = held.routes;
      held = undefined;
      await Promise.all(routes.map((route) => route.fallback()));
    },
    delayCatalog(url, ms) {
      if (delayed) throw new Error("A catalog delay is already active");
      if (!Number.isInteger(ms) || ms < 1_000 || ms > 10_000)
        throw new Error("Catalog replay delay must be 1000-10000ms");
      delayed = { target: target(url), ms, used: false, hit: signal() };
    },
    waitCatalog: () => observed(delayed, "Catalog delay"),
    async dispose() {
      const routes = held?.routes ?? [];
      held = undefined;
      delayed = undefined;
      await Promise.allSettled(routes.map((route) => route.abort()));
      await page.unroute("**/*", handler);
    },
  };
}
