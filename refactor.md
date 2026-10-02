# Refactor plan — preserve the surface, replace the simulation

The audit found useful components, strict TypeScript, explicit reference guards and passing unit/lint checks, alongside large coupled modules and no connected marketplace backend. Do not treat “clone” as permission for a clean-slate rewrite. [Tasks](tasks.md) is the only status tracker; this document explains the changes and their order.

## Findings mapped to work

Paths below are relative to `app/apps/web` unless stated otherwise. Line counts are approximate inventory sizes, not automatic split thresholds.

This table preserves the initial September 28 findings. Later task receipts supersede repaired launcher/product/seller details; do not redo accepted work because an original finding remains in the audit history.

| Finding | Evidence | Change / task |
|---|---|---|
| A01 — unsafe default preview/runtime mismatch | `scripts/dev-preview.mjs` hard-codes 6412; shell Node22/pnpm10 vs declared Node24/pnpm12 | Reproducible isolated Treido entry point and explicit toolchain, T01 |
| A02 — production intentionally hides the clone | `src/app/page.tsx`, `features/catalog/queries.server.ts`, root workspace smoke test expect preview opt-in / 404 | Keep guards; introduce explicit adapters and positive product tests, T03/T07 |
| A03 — whole reference catalog assembled per route | `queries.server.ts` merges many fixtures and passes `Catalog` into views | Narrow typed query/view models and bounded DB reads, T03/T07 |
| A04 — account/commerce are simulated | `account/state.tsx` memory fixtures; `discovery/state.tsx`; `discovery/cart-history.ts` session storage; `commerce/pricing.ts` captured prices | Separate reference state from authorized product commands, T04/T06/T08/T12 |
| A05 — large coupled UI/CSS owners | checkout ~2,464 lines; minis ~1,913; store ~1,563; account pages ~1,524; globals CSS ~4,915; account CSS ~4,449 | Responsibility-led, matched-state extraction when touched, T03 and each feature task |
| A06 — broad root styling/provider composition | `src/app/layout.tsx` imports multiple large feature CSS files and reference providers | Narrow provider consumers and CSS ownership only after measuring and comparing, T03 |
| A07 — build config carries audit history | `tsconfig.json` includes `.next-audit-final-20260924`; next config comments/output names retain donor details | Remove obsolete generated-path coupling after fresh typegen/preview proof, T01/T02 |
| A08 — test names can overstate product readiness | `app/playwright.config.ts` only smoke boundary; reference suite separate; Vitest excludes MJS script tests | Clear commands + product-mode tests + CI, T01/T02/T07 |
| A09 — clone metadata/media unsuitable for public release | root title/noindex; reference font/media handlers; captured identities and brands | Isolate assets, license/sanitize, Treido metadata/SEO and publish review, T07/T16 |
| A10 — not all latest versions are compatible | TypeScript7 vs latest typescript-eslint peer `<6.1.0`; Expo/RN matrix | Staged compatible updates, T02; never bypass strict peers |
| A11 — no durable marketplace domain | only web/mobile/contracts package owners; server modules are reference readers | Build small real domain slices, T04 onward; no imaginary existing server package |
| A12 — publication not qualified | remote connected during audit; final local and remote main match; asset/secret/history review not performed | Review existing and future published content, preserve local originals, and obtain authorization for any remediation or further publication, T16 |

## Sequence and reason

**1. Protect what exists.** T01 establishes actual app boot, isolated outputs, repeatable checks and a small representative visual baseline. Do not first complete every historical Shop flow. Existing accepted snapshots/reference assets remain intact; the new baseline is a receipt, not permission to overwrite them.

**2. Qualify dependencies separately.** T02 updates small compatible batches with a lockfile and visible regression checks. Do not combine Next upgrades, React changes, CSS rewrites and new database integration into one hard-to-diagnose change. TypeScript7 remains held until supported.

**3. Create seams around existing views.** T03 makes reference/product adapter selection explicit and introduces narrow models at the touched route boundary. Extract pure models and interaction islands without changing markup/styles. Separate reference-only pricing/data from general helpers. Keep reference fixtures usable for parity.

Initial extraction targets were listing summary/gallery/actions from `discovery/product.tsx`; seller header/results from `discovery/store.tsx`; contact/address/order sections from `account/pages.tsx`; quote display, address form and payment step from `commerce/checkout.tsx`. Accepted product/seller work is recorded in tasks; preserve it and finish the remaining T03c query boundary. `minis.tsx` gets responsibility-led extraction while implementing T15, which is included in the full first web target.

**4. Build one real seller-to-buyer loop.** T04–T09 deliver server identity, seller scope, listing drafts/media, public discovery, saves and durable communication/reporting. Use the preserved views with real projections. Authorization and minimal moderation travel with publishing; they are not a post-launch refactor.

**5. Add operational depth.** T10–T13 deliver business invitations/capabilities, offers/common allocation, one-seller unique/stocked commerce and seller entitlements. T23–T26 add the category registry, stock/variants, CSV imports and boosts. T27 adds operating recovery/account support; T28 qualifies real seller supply. Use the [schema](docs/data-model.md) and [task dependencies](tasks.md) to introduce only tables needed by each slice. Implement race/replay behavior before exposing payment/paid claims.

**6. Qualify the full target.** T14 measures query/media/mobile performance and adds caching only where justified. T15 implements all seven grounded Minis, voice/photo intake and search alerts. T16 qualifies the full F01–F29 release requested for October 1 morning: working journeys, assets, privacy, provider recovery and real supply. The sequence above is not a narrower release proposal. International/native/auction expansion remains separately scoped under T17.

## CSS and state migration method

For each touched owner: record current inputs/output/state → add characterization test → extract pure model/leaf UI → retain DOM, class names and import/cascade order → re-run same journey/screenshot → then adapt its data source in a separate change. Preserve stable keys, scroll containers and sheet focus/history behavior.

Do not rename all classes or convert all CSS to utilities/modules. Moving global feature CSS to route-local ownership can alter cascade and navigation loading; prove related routes still match. Do not replace all contexts with a new store. Separate truly server-owned data from local presentation state, then scope each provider to its consumers.

Reference helpers with captured prices, search answers, delays or identities remain under reference ownership. Product mode cannot import them as business truth. Production adapters return explicit errors on unavailable services. Retained unsupported clone surfaces stay gated rather than faking fulfillment, AI or payments.

## Exit criteria by migrated route

The route has a bounded authorized query/view model, real or explicitly selected reference adapter, correctly scoped client islands, complete failure/empty/pending states, relevant tests and a visual receipt. Public production reads succeed where implemented, reference endpoints remain denied, and private records never leak through serialization/cache/metadata.

No app-wide “refactor complete” checkbox based only on smaller file sizes. Completion is by route/use case and preserved behavior. Existing tests that verify real continuity stay; brittle source-string tests may be replaced only with equivalent behavior coverage and a documented reason.

## Rollback and stopping rules

Keep each dependency/extraction/data-source switch independently reviewable. Roll back only that task's changes, preserving unrelated work. For reference/product cutover use an explicit local/test configuration, not silent fallback. Migrations use compatible forward fixes or rehearsed isolated reversal; never undo payment state by reverting application code.

Stop the affected rollout when authority, double-sale prevention, reference isolation, critical journeys or visual lock regress. Preserve evidence and record the smallest repair. Do not disable tests, raise screenshot tolerances, force a remote history, or redesign the broken region to make the task look finished.
