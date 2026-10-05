# T71 Astra remediation checks

Run from `app/` with the repository-pinned Node 24.20.0 and pnpm 12.3.4. These checks do not require a live database, Clerk account, payment account or private environment file. Do not load `.env.local` for them.

## Unit and source checks

```sh
pnpm ci:lint
pnpm --filter @treido/contracts typecheck
pnpm --filter @treido/web exec tsc --noEmit --incremental false -p tsconfig.ci.json
pnpm exec eslint tests/t71 --max-warnings=0
pnpm exec vitest run --configLoader native --maxWorkers=1 --no-file-parallelism --no-cache
```

`--configLoader native` avoids the local Windows configuration-bundler startup issue; it does not disable test transforms, assertions or source checks. Hosted CI retains its normal unit command and independently checks the production build.

The dependency regression resolves query-string through the installed Expo Router consumer. It checks the patched decoder's default-export interoperability, Unicode, arrays/repeated keys, malformed input and a bounded child-process denial-of-service regression. It does not certify a complete native application build.

## Isolated PostgreSQL and policy checks

```sh
pnpm exec vitest run --config tests/t71/native.config.mjs --configLoader native
```

This packet contains 21 database integration checks and six issuer-policy checks. It creates new loopback PostgreSQL clusters beneath `.qa/t71`, applies repository migration sources, grants a limited runtime role and stops only its own clusters. The security/publication fixture applies 0001–0044; the billing-only fixture uses its 0001–0043 baseline. Both retain their state receipt and test data locally for inspection. No existing cluster, shared branch or live provider is used.

The database scenarios exercise current invitation authority and actual account closure, stale photo-cleanup plans (including direct SQL acceptance), re-review and resource changes, raw published numeric discovery, more than 20 billing subscriptions, concurrent scheduling, enqueue rollback and seller-first lock contention. They also preserve the pending-money guard on an abandoned provider change session; that final check is not a claim that abandoned-session recovery is implemented.

The lifecycle namespace, approval rows, complete session inventories and media bytes are explicitly synthetic. Authentication evidence is limited to registered fixture identities. External fetch is rejected. Production authorization, resource locking and acceptance SQL are not replaced with mocks. The six standalone policy tests also run in the main unit suite; do not count them twice when reporting totals.

## Local browser privacy scenarios

```sh
node tests/t71/session-browser.mjs
```

A locally installed Playwright Chromium is required. This bundles the real Saved, Following, Cart and cart-mutation components into an isolated loopback fixture. Clerk, server actions and navigation are replaced with explicit deferred test adapters. Five multi-step scenarios verify immediate concealment on A-to-B and sign-out, late old reads/mutations, failed and successful new-user refreshes, subject-bound commands, same-session idempotent retry and visibility invalidation. Screenshots and the result receipt are written beneath `.qa/t71/session/browser`.

Set the process's `TEMP` and `TMP` to a task-local directory on the same drive before running when local browser profiles must remain there. The fixture uses a fresh headless context, not a personal browser profile. `--bundle-only` checks only the bundle and explicitly does not run browser assertions.

These are deterministic browser regressions, **not signed-in Clerk/production proof or a Shop visual-parity certification**. Real configured buyer/seller/operator browser acceptance remains a separate release requirement.

## Release gates

```sh
pnpm install --frozen-lockfile --package-import-method=copy
pnpm audit --audit-level=moderate
```

Keep the audit unsuppressed. A local test result does not authorize a merge or deployment. See the repository's October 5 Astra remediation report and the final T71 receipt in `tasks.md` for exact tested-source evidence, remaining findings and publication status. Historical T61 receipts are retained and are not re-labelled as measurements of T71.
