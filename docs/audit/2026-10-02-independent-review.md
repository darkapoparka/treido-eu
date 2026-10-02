# Independent UI and release-boundary review — 2 October 2026

Owner: T32, separate from the concurrent T31 documentation/quality-tooling writer. This review does not replace the [task queue](../../tasks.md), [styling contract](../../styling.md), [seller workspace](../seller-workspace.md) or [testing contract](../testing.md).

## Scope and evidence

Reviewed the canonical `L:/PLATFORMS/treido-eu-global` checkout, its actual source and manifests, retained Shopify captures, and a new isolated Chrome context against the existing loopback 6418 preview. No user browser profile, authentication cookies or Shopify store data were copied. The signed-in Codex browser has no exposed transport in this ChatGPT session; existing source captures were inspected, not represented as newly captured Shopify states. Fresh ADB inventory contains no emulator, including assigned `emulator-5560`; native parity was not rerun.

Private evidence directory: `C:/Users/radev/Documents/Codex/2026-10-02/treido-independent-review/`. Keep source screenshots outside this public repository. `source-before.json` fingerprints 530 application source/migration/manifest/lock files. Browser facts, test logs and independent public registry observations are stored beside it. Final verification below owns the completion status.

## R1 — Localized accessibility labels change buyer icon styling

**Confirmed regression; remediation open.** The buyer dock uses localized `aria-label` values, while optical styling in [globals.css](../../app/apps/web/src/app/globals.css) selects English labels. Do not solve this by keeping English accessibility labels in Bulgarian or removing calibrated English geometry.

Reproduction: in the explicitly enabled local reference preview, use a fresh context with the non-authoritative `shop-preview-onboarded=1` preference; visit `/?lang=en` and `/?lang=bg` at 393 × 793, DPR 1. Inspect computed styles of `.floating-nav a svg`. Chrome was `154.0.8037.93` on Windows; fonts were loaded.

| Destination         | English computed transform        | Bulgarian computed transform |
| ------------------- | --------------------------------- | ---------------------------- |
| Home / Начало       | `matrix(1, 0, 0, 1, 1, -1.5)`     | `none`                       |
| Explore / Разгледай | `matrix(1, 0, 0, 1, -0.25, -0.5)` | `none`                       |
| Orders / Поръчки    | `matrix(1, 0, 0, 1, -1, -0.75)`   | `none`                       |

The measured SVG dimensions were 24 × 24 in both languages; the regression is optical positioning, not container overflow. Evidence: `buyer-dock-en.json`, `buyer-dock-bg.json`, `buyer-home-en-393.png`, `buyer-home-bg-393.png`.

**Required bounded fix:** use a stable semantic class or data attribute for dock destinations in the existing component and stylesheet. Preserve translated accessible names, link destinations, English computed geometry, active state, icon artwork and navigation behavior. Compare EN/BG normal and 200% text at 320/393px and desktop; add a browser regression assertion for identical locale-independent icon geometry. Search the owning styles for other localized-text selectors. This review deliberately does not edit application TSX/CSS while T31 finalizes the contracts.

**Agent rule for T31 integration:** accessible copy and translations are content, not styling or authority keys. New rules should use stable semantic hooks. Existing text-dependent selectors require a measured migration, not a global normalization.

## R2 — GitHub has no active merge-quality enforcement

**Confirmed release gap.** The connected repository is `darkapoparka/treido-eu`. GitHub `main` resolves to `986f328f1ffe4523a251547d44ca2576c160c860`, matching local HEAD, not the extensive uncommitted implementation. The branch response reports `protected: false`, required-check enforcement `off`, and no required contexts. The repository ruleset list is empty. The repository-wide Actions run response reports `total_count: 0`.

These are direct, read-only GitHub connector observations, not an inference from a missing local badge: [branch](https://api.github.com/repos/darkapoparka/treido-eu/branches/main), [rulesets](https://api.github.com/repos/darkapoparka/treido-eu/rulesets), [Actions runs](https://api.github.com/repos/darkapoparka/treido-eu/actions/runs?per_page=5). No settings, branches, commits, pull requests or remote files were changed. One unsupported workflow-list fetch was rejected; the supported repository-wide run endpoint supplied the evidence above.

**Release acceptance:** review and isolate the dirty implementation into authorized commits, run the intended workflow on GitHub, require its actual passing job names for protected merges, and verify that a deliberately failing check blocks a test PR. Include the production-reference rejection gate, positive authorized product journeys, dependency audit and documentation checks. A workflow YAML or local test pass alone does not satisfy this gate. Keep T02's existing CI/security ownership; do not create a competing release queue or blindly push the dirty tree.

## R3 — Current implementation is not a connected hybrid marketplace

**Confirmed boundary, not a newly introduced bug.** At `/search?seller=personal&lang=en`, the current preview states that seller-type discovery is not connected and that it has no verified results for that type. The selector/URL contract exists, but this is not evidence of business/personal listings being fetched from a real public catalogue. Private seller adapters and isolated database tests likewise do not establish live Clerk/Neon acceptance.

Preserve the correct separation from the [marketplace contract](../marketplace.md): human identity, current seller membership/capability, public seller-kind filtering, trader declaration and plan entitlement are different authorities. Public listing results, facets, counts and cursors need the same normalized seller/eligibility predicates. Private reads, writes, retry acknowledgements and draft buffers need current actor/seller/resource scoping. Removed membership must deny access even with an old URL, cached UI or retry key. An empty authorized dataset and an unavailable provider must remain distinguishable.

**Release acceptance:** two independent humans, a personal seller and two businesses; each can see only permitted private resources, and independent buyers receive correctly filtered eligible public supply. Verify stale requests, Back, seller switching, revocation, direct URLs, counts/facets/cursors and cache isolation through real authenticated application transport. Synthetic preview storage isolation is useful UI evidence, not proof of this integration.

## R4 — Full source parity remains unqualified

Fresh local desktop Home was visually inspected against the retained signed-in Shopify desktop capture under `treido-shopify-admin/exact-parity/studio-verification/`. The rounded canvas, compact typography, composer and first-card geometry remain close to the inspected source. Original Treido art, marketplace copy, the extra website exits and finite local Mini are intentional differences. The Chrome revision and capture time differ; no pixel-identical comparison is claimed.

T30e already records unclosed editor formatting/price/shipping/metafield differences, Growth campaign differences, missing Markets graph/suggestions, only General Settings directly compared among 19 Settings panels, unverified populated source states, and remaining English forms in BG mode. These are still open unless a later owner supplies matched evidence. Responsive web does not establish native Shop parity; a local route/layout sweep is not a source comparison.

**Acceptance vocabulary:** use `implemented`, `locally exercised`, `source-compared`, `connected-qualified` and `release-qualified` separately. Record the exact route, state, fixture/account kind, locale, viewport/DPR, browser/OS, font readiness and approved differences. Do not count routes, screenshots or assertions as interchangeable forms of coverage. Never replace legitimate empty/denied/provider-unavailable states with attractive sample success.

## R5 — Dependency currency and security qualification are separate

A fresh read-only registry check is in `registry-review.json`; it queries the public npm `latest` endpoints and records each declaration, check time, peer requirements and engine constraints. No package installation, manifest/lockfile edit or toolchain switch was performed. Representative observations:

| Package                   | Current manifest | Registry latest observed |
| ------------------------- | ---------------- | ------------------------ |
| Next / eslint-config-next | 16.3.4 / 16.3.4  | 16.3.8 / 16.3.8          |
| React / React DOM         | 19.2.3 / 19.2.3  | 19.3.0 / 19.3.0          |
| pnpm                      | 12.3.4           | 12.8.1                   |
| TypeScript                | 6.0.3            | 7.0.2                    |
| typescript-eslint         | 8.70.0           | 8.71.0                   |
| Clerk Next adapter        | 7.9.9            | 7.9.10                   |
| Vitest                    | 5.0.0            | 5.0.3                    |
| Sharp                     | 0.35.4           | 0.35.5                   |
| Tailwind / Playwright     | 4.3.3 / 1.63.0   | 4.3.3 / 1.63.0           |

The default terminal reported Node 22.20.0/pnpm 10.32.1, while this project pins Node 24.20.0/pnpm 12.3.4. All actual T32 Node commands used the existing explicit Node 24.20.0 executable; the audit additionally used the existing pnpm 12.3.4 `bin/pnpm.mjs`. [Node's release page](https://nodejs.org/en/about/previous-releases) currently lists 24.21.0 as latest LTS, not the latest Current-major release as the production target. [typescript-eslint's supported range](https://typescript-eslint.io/users/dependency-versions/) remains TypeScript `>=4.8.4 <6.1.0`; do not install TypeScript 7 merely because it is the newest registry release. React/native changes require the retained Expo compatibility matrix, not independent upgrades.

**Fresh security audit: FAIL.** At 2026-10-02T11:47Z, pinned pnpm `audit --audit-level=high --json` exited **1** and reported metadata counts of **1 critical, 5 high and 4 moderate**. These are audit metadata counts, not a count of distinct exploitable production paths. Raw output is `security-audit.json`; normalized metadata/advisory paths are in `security-summary.json`. The PowerShell wrapper completed normally after printing the audit's failing exit code; its own exit 0 must not be mistaken for audit success.

The audit identifies Next 16.3.4 in the affected range for [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), with a patched range starting at 16.3.6. Other returned high records include brace-expansion and node-forge in development/native tool chains. This metadata is not proof that the running application exposes the vulnerable operation. T02b must assess affected paths and make the reviewed remediation; do not suppress the audit or claim an upgrade has already happened.

**Upgrade gate:** isolate the security/framework patch first with matching Next lint configuration; preserve the lockfile resolution and Expo/React peers. Run frozen install, types, lint, unit/native tests as applicable, production build/output/reference-denial checks and relevant UI comparisons before merging. Qualify lower-risk package-manager/tooling patches separately. Keep [techstack.md](../../techstack.md) and T02 as the canonical dependency decision/implementation owners; this independent observation is not an alternative upgrade policy.

## Independent verification receipt

| Check                                                          | Result                                | Evidence and limit                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused existing unit suites                                   | PASS: 113 tests / 6 files             | `focused-unit.log`; merchant model/search/Mini, browse scope, seller capabilities and private recovery; not the full suite or live provider qualification        |
| Serialized local browser assertions                            | PASS: 14                              | `checks.json`; six Home widths, two phone heading checks, global-search size/empty/dismissal and phone navigation/store-return assertions                        |
| Measured Home widths                                           | PASS: 320, 393, 768, 1024, 1440, 1920 | Normal EN; loaded fonts; no document overflow. Phone heading remains 26px/32px, 64px tall. Not a new BG/200%-text sign-off                                       |
| Matched local desktop geometry                                 | OBSERVED                              | 1440 × 900: first cards at x357/673/989, y407.1875, each 300 × 344. Search dialog is 648 × 480                                                                   |
| Buyer locale comparison                                        | FAIL: R1                              | EN/BG dock optical transforms differ; no application repair included                                                                                             |
| Public Personal scope                                          | OBSERVED UNAVAILABLE                  | Actual browser text explicitly disclaims verified seller-type supply; not a successful catalogue integration                                                     |
| Runtime source preservation                                    | PASS                                  | `source-verification.json`: all 530 pre-existing fingerprinted source/migration/manifest/lock files unchanged; AGENTS excluded to allow T31's documentation work |
| Browser runtime errors                                         | None observed in exercised pages      | `browser-errors.json`; this is a page-error event log, not an exhaustive network/console/security scan                                                           |
| Fresh dependency audit                                         | FAIL                                  | Audit exit 1, metadata 1 critical / 5 high / 4 moderate; not suppressed                                                                                          |
| GitHub merge enforcement                                       | NOT CONFIGURED                        | R2: no rulesets, protected branch or Actions runs observed                                                                                                       |
| Native and fresh signed-in Shopify parity                      | NOT RUN                               | No emulator-5560 and no exposed signed-in Codex browser transport; retained source images were reviewed instead                                                  |
| Production build, real private transport and provider journeys | NOT RUN                               | Independent docs/review scope; existing preview was not restarted or promoted                                                                                    |

Unit command, run from `app/` with explicit Node 24.20.0: `node node_modules/vitest/vitest.mjs run tests/merchant-frontend-preview.test.ts tests/merchant-mini-preview.test.ts tests/merchant-search-preview.test.ts apps/web/src/features/discovery/browse-scope-route.test.ts apps/web/src/features/sellers/capabilities.test.ts apps/web/src/features/sellers/private-recovery.test.ts --maxWorkers=1 --no-file-parallelism`.

The initial interactive measurement attempt could interleave top-level awaits; its output is retained separately as `initial-checks.json`. Only the subsequent serialized 14 assertions in `checks.json` count as verification. A public-scope wait incorrectly expected a buyer dock on the deliberate unavailable state; reading the actual state resolved that harness assumption. A later additional browser/private-route batch was blocked by tool safety validation and was not retried through another mechanism; it contributes no checks. The owned headless browser was closed, leaving the user's Codex browser and loopback server alone.

A bounded text search of the fingerprinted application source found no direct `next/og` or `ImageResponse` references (`og-source-search.json`). That is not a complete reachability analysis. The [maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) specifies attacker-controlled SVG content/attributes/styles through Node ImageResponse as the affected usage; security remediation remains open.

`localized-style-hooks.json` maps R1 to `features/discovery/components.tsx` and the dock selectors in `app/globals.css`. It also inventories label-based selectors in checkout/product/live-shop styles. Those additional selectors are review candidates, not all independently confirmed regressions. T31 should incorporate the stable semantic-hook rule into the canonical pattern/agent contracts; the bounded dock repair belongs to the task queue, not this audit file.

## Review completion and handoff

T32 review is complete; it does not mark R1–R5 remediation or production readiness complete. Owned Markdown formatting passed. All seven relative file links in this review resolve inside the repository; the owned-file check found no replacement characters or trailing whitespace (`documentation-checks.json`). This is not a claim that every canonical document or the concurrently written T31 validator has been verified.

T31 retains its canonical docs/AGENTS/validator claim and should integrate the semantic-hook rule and fresh audit findings. T32a owns the queued bounded dock fix. T02 retains dependency remediation and hosted CI qualification; T30e retains the source-parity gaps. Provider/catalogue qualification stays in the existing implementation/release tasks. No commit, push, deployment, package change or application styling change was made by this review.
