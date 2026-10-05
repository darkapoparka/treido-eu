# Testing and verification

A test command's existence is not proof of its coverage. Keep reference parity, product behavior, database security and release verification distinct. The dated [audit](audit/2026-09-28.md) records this pass; [tasks](../tasks.md) records later evidence.

## Existing commands — run from `app/`

| Command | Actual scope / prerequisite |
|---|---|
| `pnpm test:unit` | Vitest: `tests/**/*.test.ts` and `apps/web/src/**/*.test.ts` |
| `pnpm test:database` | Separate native UTF8 PostgreSQL integration suite: fresh owned loopback cluster, real runtime role, reviewed migrations, ownership, draft/setup persistence and revisions, private declarations, intent, quota and revocation races; preserves cluster/evidence and stops only its own server. Synthetic verified-identity inputs do not prove live Clerk/Neon qualification. |
| `pnpm --filter @treido/web exec eslint src --max-warnings=0` | Focused web-source lint; not all workspace tooling |
| `pnpm --filter @treido/web typecheck` | Next route type generation, then `tsconfig.build.json` |
| `pnpm typecheck` | Turbo workspace typechecks, including retained native/contracts |
| `pnpm lint` | Workspace lint plus root tests/MJS, broader than the focused audit |
| `pnpm format:check` | Prettier across the inherited package workspace; existing formatting debt must be reported |
| `pnpm build:web` | Production Next build; not proof that product routes work |
| `pnpm test:smoke:web` | `playwright.config.ts`: current non-preview 404/reference-boundary assertions; requires build |
| `pnpm exec playwright test --config playwright.reference.config.ts <spec>` | Reference journeys; verified owned preview or its configured isolated server |
| `pnpm native:check` | Expo compatibility/doctor and iOS/Android exports; not device/store acceptance |

`pnpm check` currently includes lint, format check, typecheck and unit tests, but not build/browser/database tests. The Vitest include pattern excludes two `scripts/shop-parity/*.test.mjs` files. Decide explicitly how to run maintained script tests; do not claim every test ran from the 161-test unit result.

The database suite runs explicitly through `vitest.database.config.mjs`; it is excluded from ordinary unit tests. Its `embedded-postgres` dependency supplies real native PostgreSQL and is development-only. Windows uses the package's `pg_ctl` for graceful startup/shutdown so captured pipes and PostgreSQL I/O workers cannot outlive the test. The test database uses explicit UTF8 encoding and C locale to preserve Bulgarian data on Windows. No `DATABASE_URL` from the project is used by this harness. `TREIDO_DATABASE_EVIDENCE_ROOT` optionally places the retained clusters/logs on another owned artifact volume; default evidence stays in `.qa/t04b-drafts-20261001/database`. Optional `TREIDO_SETUP_BROWSER_HELPER` loads a supplied local component/native-database harness separately; passing that harness does not qualify the Clerk SDK, Next action transport or live providers.

## Initial audit evidence (September 28, 2026)

Using `C:/Users/radev/AppData/Local/nvm/v24.20.0/node.exe` directly with installed package CLIs:

```text
cwd app: node node_modules/vitest/vitest.mjs run
  PASS: 19 test files, 161 tests, exit 0
cwd app/apps/web: node node_modules/eslint/bin/eslint.js src --max-warnings=0
  PASS: exit 0, no diagnostics
```

No dependency installation or update was needed for these checks. No build, Next type generation, browser/reference run, new screenshot comparison, native export, vulnerability audit or backend/provider integration was performed. Local raw logs are under `L:/Temp/treido-eu-audit-20260928/`. They do not contain a production-readiness claim.

## Visual and browser baseline

T01 records actual matching home, search, listing, seller, cart and representative sheet/account states. Preserve existing 393×793 reference tests; add affected desktop/long-copy cases from [styling](../styling.md). Check browser console, hydration, network failures and asset/font readiness. Record input fixture, cookies, viewport, browser/OS, commit and route/scroll/overlay state.

`playwright.reference.config.ts` supports `REFERENCE_BASE_URL` for a confirmed loopback preview. Never point it at a donor/shared server or production. Avoid running a second Next process into an output directory owned by another process. The repaired `pnpm dev:web` launcher owns loopback port 6418 and `.qa/treido-preview`; port 6412 remains protected. `pnpm test:tooling` verifies its port/environment contract. Current implementation evidence is in the root task receipt. For a preview that survives its launching terminal, run `pnpm --filter @treido/web dev:preview --background` from `app/`. It uses loopback 6418 and project-local `.qa/treido-preview-background`, with startup output in that directory. Starting it does not stop another listener. The foreground command remains available.

Reference data requires `SHOP_REFERENCE_PREVIEW=1` and is denied when `NODE_ENV=production`, `VERCEL_ENV=production`, or a hosted `VERCEL` flag is present. This one policy protects catalog/search queries, product-detail/context queries, scenario selection and reference media. The reference harness starts `next dev` when no external preview is supplied and rejects donor port 6412. Production builds are verified with non-preview boundary smoke checks, not by enabling fixture pages under `next start`.

## Seller architecture acceptance

These are required tests for the implementation tasks, not tests run by the October 1 documentation decision. Keep pure policy tests and real isolated integration evidence distinct.

| Boundary / owner | Positive case | Required denial/recovery case |
|---|---|---|
| Capability/readiness — T04e | Personal draft and business draft/publish/payment each get the correct requirements | Browse scope, paid plan, setup percentage or forged capability cannot grant authority; revoked/restricted/missing facts fail closed |
| Session/data — T04b | Verified subject maps idempotently; personal seller and two businesses persist | Foreign composite IDs; least-privilege role; concurrent user/seller creation; revoked-member mutation races; failed transaction releases its connection |
| Entry/onboarding — T04c/T04d | Guest resumes intended personal editor; business setup survives another device/session | External continuation; expired session; duplicated setup; prefetch/GET creates zero sellers/drafts; old seller responses and private buffers cannot overwrite new context |
| Job foundation — T04f | Committed intent reaches one observed domain effect | Crash before dispatch/after executor acceptance/after provider success, stale lease, duplicate/reordered events, signature/environment mismatch, poison job and redrive; required service recovery survives staff revocation |
| Media/editor — T06 | Ready owned bytes publish at one revision/quota slot | Foreign/oversized/malformed/replaced upload, stale autosave, disconnected provider, simultaneous last-slot publish and unauthorized idempotency replay |
| Merchant management — T06d/T10 | Filtered listing rows and allowed bulk actions; current team/context | Mixed foreign/revoked/stale row selection, duplicate draft creation, final seat and last-owner races; missing adapter is not an empty success |
| Connect/commerce — T12 | Hosted onboarding returns and server confirms readiness; funded order and exact transfer facts | Expired/reused account link, incomplete return, capability loss, payment/hold race, automatic destination transfer followed by refund/reversal, out-of-order receipt and insufficient balance |
| Whole merchant flow — T10c | Personal and business create → publish → independent buyer discovery/contact → qualified order/fulfil/refund; stock/import/team/billing views use real adapters | Cross-business isolation, reload/Back/logout, long BG/EN at 320px and 200% text, keyboard/focus, service outages and responsive desktop tables |

Run database race tests with separate connections and synchronization barriers against isolated PostgreSQL, including the actual runtime role; a mocked ORM cannot prove locking/constraints. Provider tests use their intended isolated/sandbox resources. Record changed-route screenshots against matched pre-edit states for existing surfaces, and an explicit acceptance set for new merchant screens. The documentation task itself needs link/task-dependency/diff/fingerprint verification, not an unrelated app build or a claimed fresh native comparison.

## Test each layer for a different reason

**Unit:** pure parsing, money/quantity bounds, reducers, revisions, permission predicates, state transitions and URL normalization. Use table-driven edge cases; avoid testing only implementation details or source text strings.

**Integration:** real isolated PostgreSQL schema/migrations, actual runtime role, unique/FK/check constraints, seller/actor isolation, idempotency, concurrent quota/allocation and transaction rollback. Mocking a repository cannot prove a database race is safe.

**Provider contract:** signed webhook verification, duplicate/out-of-order events, idempotency, timeouts and sandbox reconciliation. A local fixture called “connected” is not a connected provider test.

**Browser:** real user journeys, forms, keyboard/focus, URL/history/scroll, stale response recovery, accessible errors and mobile/desktop states. Reference tests continue to protect preserved behavior; add product-mode journeys rather than rewriting every expectation to accept mocks.

**Visual:** matched screenshots and inspected diffs for rendered changes. Review intentional differences separately; never accept a changed baseline solely because it makes CI green.

## First product regression set

Cover guest search with personal/business/condition combinations; direct listing and seller links; login and return path; saved-state reload; draft/upload recovery; cross-user denial; publish/withdraw/moderation removal; durable send/retry/report; wrong-business membership and revocation. Financial work adds the failure/race matrix in [billing](../billing.md).

Keep a positive production route test next to a negative reference-route test as routes migrate. The current smoke suite expects `/`, `/search`, `/profile` and `/checkout` to be 404 with preview disabled; a green run today therefore does **not** mean a usable marketplace.

## Complete first-web release matrix

Map each F01–F29 feature from [features](features.md) to its task receipt and the J01–J12 paths in [journeys](journeys.md). A target column or existing test filename is not a pass. Required release evidence is in [launch](launch.md).

| Feature family | Positive path | Denial/race/recovery proof |
|---|---|---|
| Human/seller authority | Signup intent, personal seller, two business memberships and seller switch | Foreign/revoked IDs, repeated creation/invite, final seat, last owner, private serialization |
| Categories/drafts/media | All registry leaves/typed profiles, real recoverable draft/photos/publish | Disabled/root leaf, stale version/save, forged/foreign media, concurrent final quota, moderation restriction |
| Public discovery/storefront | Scoped BG/EN search/facets/detail/store, canonical sharing and Back | Used business/new personal, cursor mismatch, stale responses, removed/empty/error/direct links, no reference fallback |
| Saves/messages/offers | Reload persistence, scoped inbox/read state, counter/acceptance and notifications | Retry/foreign attachment, revoked member, block, offer/checkout race, expiry/history retained |
| Stock/checkout/fulfilment | Unique item, business variants, multi-line one-seller order, shipment/pickup | Last quantity/all-line rollback, quote tamper, slow/late payment, duplicate/out-of-order effects, partial refund/dispute/restore |
| Plans/imports/promotions | Four plan mappings, downgrade/invoices, reviewed CSV drafts, labelled boost | Concurrent caps/replay, malformed/duplicate rows, cancelled import, cross-scope sponsored slot, restricted paid listing, compensation |
| Assistants/alerts | Seven useful tools, editable filters, voice/photo, grounded comparisons and alerts | [60-case eval suite](assistants.md), fabricated IDs/prices, prompt injection, budget/stream failure, media deletion, opted-out/removed result |
| Operations/account/supply | Operator resolves report/case, account export/closure, restore and actual seller supply | Unauthorized operator, privacy/retention, failed lease/delivery, open money case, no synthetic counts or sample dashboards |

For changed render states, retain matched mobile/desktop screenshots and inspect actual flows, focus, keyboard, Back/Forward, scroll, loading/pending/errors, 320px and long Bulgarian/English text. Check fonts/images/console/network and 200% text on affected form/assistant/order paths. Static screenshots and an unchanged shared defect do not establish usability. Native/device/store acceptance remains its own T17 scope.

Documentation-only changes use scoped link/anchor/requirement/task consistency checks and fingerprints of runtime source/config; they do not rerun a full application suite or imply new UI/provider qualification. Record exact counts, scope and limitations in the documentation task receipt.

## CI and completion policy

T04f/T06b add native PostgreSQL cases to `pnpm test:database`: reviewed job/media migration rollback/replay, least-privilege lifecycle grants, duplicate/stale leases, provider-result replay, dead-letter generations, staff revocation versus service recovery, final photo-slot races, immutable input, actual Sharp processing, revisioned reorder/removal and removal during processing. `TREIDO_DATABASE_EVIDENCE_ROOT` keeps owned clusters/logs on a disk with headroom. An optional `TREIDO_MEDIA_BROWSER_HELPER` runs the actual editor over native use cases through an isolated browser transport; its synthetic identity and storage are explicitly not live Clerk/R2/Inngest evidence. Never add that transport to application routes.

The production output checker now accepts the exact manifest-pinned owned Sharp runtime junction required for bounded raster processing, alongside the existing exact pg exception. It still rejects another target/version/peer pin, private/escaped packages, nested junctions, and unqualified fonts/video. Focused positive/negative tests qualify the allowance. A green build or native/component check does not qualify connected provider access, public publication, file rights or retention.

The root [CI workflow](../.github/workflows/ci.yml) runs on pushes to `main`/`codex/**`, pull requests and manual dispatch. Its Ubuntu 24.04 job installs the exact Node version from `app/.node-version` and pnpm version from `app/package.json`, verifies both, then runs a fresh `pnpm install --frozen-lockfile --package-import-method=copy`. Action revisions are pinned to full commit hashes. Checkout has read-only repository permissions and does not persist credentials; package-manager caches are disabled. It requires no provider secrets, private reference archives or emulator. T71 adds fresh loopback PostgreSQL regressions and a pinned Chromium installation for its explicit component-session fixture; neither uses a real account or qualifies live providers.

Run its package commands from `app/`:

| Command | Maintained CI scope |
|---|---|
| `pnpm ci:format` | Root workflow, package command wiring, CI type configuration/output checker and workspace-resolution test; inherited whole-workspace formatting debt remains visible in `format:check` |
| `pnpm ci:lint` | Web source, preview launcher/options/tests, shared contracts, new CI scripts and workspace-resolution test, with zero warnings |
| `pnpm test:unit --maxWorkers=1 --no-file-parallelism` | Existing Vitest selection, including web/contracts/workspace tests; does not cover every historical MJS script or native journey |
| `pnpm test:tooling` | Maintained preview-launcher environment/port boundary tests |
| `pnpm test:ci` | Production-output confinement, missing/malformed build traces and unqualified font/video rejection |
| `pnpm exec eslint tests/t71 --max-warnings=0` | The portable native/database/browser regression harnesses, in addition to the existing CI lint scope |
| `pnpm exec vitest run --config tests/t71/native.config.mjs --configLoader native` | Fresh restricted-runtime PostgreSQL tests for invitation authority, closure cleanup consistency, numeric discovery and billing scheduling, plus issuer-policy checks; no shared database or provider requests |
| `pnpm exec playwright install --with-deps chromium` and `node tests/t71/session-browser.mjs` | Install the lockfile-pinned browser and exercise actual private buyer components through deferred identity/action fixtures; not real signed-in Clerk journeys |
| `pnpm ci:types` | Contracts TypeScript, Next route type generation and strict web TypeScript using `tsconfig.ci.json` |
| `pnpm --filter @treido/web build` | Direct Next production build using the same isolated output/type configuration; bypasses Turbo so the job's output environment is passed directly |
| `pnpm ci:verify-output` | Completed build ID, dependency traces confined to `app/`, known private reference directory rejection and emitted font/video policy |
| `pnpm test:smoke:web --workers=1 --reporter=line` | Existing HTTP reference-denial spec, first normally and then with `REFERENCE_SMOKE_OPT_IN=1`; uses Playwright's request client, no browser |
| `pnpm audit --audit-level=high` | Fails the job on high/critical dependency advisories; moderate findings remain reported and require review |

For types and build, the workflow sets `NODE_ENV=production`, `VERCEL_ENV=production`, `SHOP_REFERENCE_PREVIEW=0`, `SHOP_PARITY_DIST_DIR=.qa/treido-ci` and `SHOP_PARITY_TSCONFIG_PATH=tsconfig.ci.json`. CI's type configuration inherits the existing strict build configuration and includes only that output's freshly generated route types. Run these commands in an isolated checkout or task-owned source snapshot: Next type generation updates `next-env.d.ts`, so do not point it at the source/output owned by a running preview. Both smoke invocations use `VERCEL_ENV=production` and the same build output.

The workspace link test checks the current product-root documents, confines relative file links to this repository and requires their targets to exist. Historical `app/` documents may refer to local machine archives; they are source evidence rather than CI's owning product documents. The output check is an initial publication boundary: this build has no qualified font/video binaries, so emitting them fails. A later owned-media task must qualify any allowance explicitly. Trace/HTTP checks do not prove source provenance, database isolation or security certification.

T02a's receipt records local Windows reproduction against a newly downloaded dependency store separately from the first GitHub-hosted Linux run. A workflow file and local replay cannot establish that hosted run as passed. The dependency audit has no silent ignore or `continue-on-error`; T02b owns reviewed compatible security patches before the gate can pass. Add real product browser and isolated database/provider checks as those adapters become usable; current reference 404 checks are not a connected marketplace test.

For a task mark each check `PASS`, `FAIL`, `NOT RUN` or `BLOCKED`, with command, reason and evidence. Fix regressions introduced by the change. Record unrelated baseline failures without disabling them. A blocked required acceptance check prevents `DONE`; preserve a useful code draft and an exact next action instead.

Product-detail/context smoke coverage includes malformed/missing context requests, a deferred read failure with retry and focus recovery, and long Bulgarian/English headings at 320/390px. Production smoke covers 11 paths, including detail/context and private reference image/video/font endpoints. Run it normally, then with `REFERENCE_SMOKE_OPT_IN=1`; production must reject reference data even with attempted opt-in. Reference reader imports/file reads also have compile-time production branches so private archive assets never need to be traced into a release. Check generated dependency traces and output assets in addition to HTTP denial.

## Product documentation contracts — T31

From `app/`, run `node scripts/check-product-docs.mjs` and `node --test scripts/check-product-docs.test.mjs`. The read-only offline check validates maintained root/owning docs, relative file links and generated/explicit anchors, scoped AGENTS routing, four skill metadata records, executable task IDs/states/prerequisites/cycles, and declared dependency/runtime pins against the dated snapshot linked by `techstack.md`. It reads no secret values, performs no package install and changes no runtime files. Historical donor prose is excluded, not promoted into the current contract.

The 15 tooling tests cover parsing, explicit HTML/Unicode anchors, path confinement, missing/duplicate/invalid/cyclic task definitions and pin drift. These are tooling tests, not 15 marketplace or visual tests. The existing CI runs them before package installation and checks the two owned scripts with pinned Prettier/ESLint after install. Hosted execution still requires a separately authorized push and successful workflow run.

The validator checks documented declarations, not whether a latest tag changed overnight, external URL availability, full CommonMark rendering, source-image parity, operator permission or provider readiness. It validates dependency structure, not whether a partially qualified prerequisite permits a READY task; the owning receipt explains those exceptions. [Documentation ownership](documentation.md) and [UI verification](ui-verification.md) govern the complementary review. Existing full CI, audit, database and release gates are unchanged.


### Stock, offers and importer component journeys

The native PostgreSQL suite includes `stock, cart and offers` and `durable business CSV` groups. Optional `TREIDO_STOCK_BROWSER=1` and `TREIDO_IMPORT_BROWSER=1` exercise the actual buyer/merchant components through the existing local, test-only action transport. These checks verify persisted stock/cart/offer commands, CSV upload/review/correction/selection, real draft/stock creation, cancellation/recovery and account-change hiding. They use synthetic verified identities, never a production authentication bypass, and do not qualify live Clerk, photo storage or the signed cloud executor. Run the relevant group after its implementation batch; root tasks.md owns counts and actual outcomes.

### T71 hosted source qualification

The c788d9e review's clean Linux checkout passed 1,799 units (one original optional skip), all existing lint/type steps and the production build, then exposed an unqualified Inngest external runtime link in the production-output checker. The follow-through adds a narrowly importer-bound allowance: exact declared and installed SDK identity/version, canonical ownership inside the workspace's pnpm virtual store, and the same target used by the web importer. Nested/unreviewed links and captured media/private traces remain rejected. Twelve new positive/adversarial cases bring the output-policy suite to 45. This is a packaging qualification, not authorization for Inngest's real provider binding or an audit waiver. The [Astra remediation report](audit/2026-10-05-astra-remediation.md) distinguishes each hosted observation from local and fixture-only evidence.

### Current production smoke contracts

The T71 smoke packet distinguishes reference-only endpoints (strict 404 and donor-data denial) from delivered real routes. With no provider/database secrets, Home/Search must return the real unavailable marketplace, Checkout must return unavailable purchase reviews, and the language shortcut must redirect only to real privacy preferences with the selected locale. Reference cookies and attempted production opt-in must not replace those routes with donor data. Both ordinary and attempted-opt-in runs also retain all five browser selling-preparation checks, using the installed Chromium. These are honest unconfigured-state checks, not a claim of live provider or signed-in acceptance. Historical pre-marketplace 404 receipts above retain their original dated source scope.

The T71 database packet explicitly supports Windows and Linux x64 only. Its isolated fixtures select host-specific installed binaries and reject unsupported platforms, while retaining limited runtime grants, synthetic rows and exact owned-cluster shutdown. The platform change does not skip database assertions or alter the production migration inventory.


## T72 launch-feature packet

[The public T72 packet](../app/tests/t72/README.md) adds real runtime-role PostgreSQL invitation/image/job checks, an isolated single-user billing constraint run, deterministic attachment-browser scenarios, and four real-route seller-onboarding/support smoke cases. CI runs these as required steps alongside the prior checks. The current T71 native replay includes additive0045–0047 because current commands require their columns; historical T71 receipts retain the original44-migration scope. Provider mocks and unconfigured production routes do not establish intended live Clerk, Resend, private storage, Stripe, consenting supply or operational acceptance. [The implementation report](audit/2026-10-05-launch-features.md) records actual observations and limits.
