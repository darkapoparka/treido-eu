> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Single-session execution

Use the checkout, two-branch limit and one-writer policy in [AGENTS.md](AGENTS.md). [Codex setup](docs/agents/codex.md) owns synchronization; this file owns only the Shop implementation and reference loop.

## Resume, do not restart

Read [AGENTS.md](AGENTS.md), [current status](docs/STATUS.md), the owning [task](tasks.md), and [the implementation map](shop-implementation-map.md). Inspect actual source and git state. Load only the relevant source family and skill, not all archived docs. Do not create another parity pipeline or recount routes as completed screens.

The active queue spans the Shop frontend parts of Tasks 3/5/6. Start from the current recipes and reproduce the relevant outstanding issue. Finish complete related families, including connected interactions, before moving onward. Keep the rest of the frozen corpus in scope; avoid polishing one card indefinitely while leaving other states unmapped.

## Existing local reference loop

Confirm the repository, branch, pinned runtime, ignored local assets and listener ownership. Review `.github/workflows/shop-parity.yml` and `playwright.reference.config.ts` for the existing harness. The documented local parity preview uses these explicit environment values in the SAME terminal that starts the server:

```powershell
$env:SHOP_REFERENCE_PREVIEW = '1'
$env:VERCEL_ENV = 'preview'
$env:SHOP_PARITY_BASE_URL = 'http://127.0.0.1:6412'
$env:PLAYWRIGHT_CHANNEL = 'chrome'
node prepare-shop-reference.mjs --verify
pnpm --filter @treido/web exec next dev --hostname 127.0.0.1 --port 6412
```

Use the installed browser channel actually available. `--verify` checks the existing allowlisted media; a failure requires provenance-aware preparation/review, not new expected hashes. Starting this opt-in preview does not authorize any real provider action. Do not reuse an unidentified listener or take over another project's server.

If the local pnpm shim fails, use the already installed runtime; do not reinstall the stack. Verified on2026-09-20: Node24.19 at `C:/Users/radev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`, Next16.3.4 at `apps/web/node_modules/next/dist/bin/next`. After confirming6412 is free and no Treido dev/build process owns the same output directory, start persistently from PowerShell:

```powershell
$env:SHOP_REFERENCE_PREVIEW = '1'
$env:VERCEL_ENV = 'preview'
$nodeRuntimeDir = 'C:\Users\radev\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
$env:PATH = $nodeRuntimeDir + ';' + $env:PATH
Start-Process -FilePath "$nodeRuntimeDir\node.exe" `
  -ArgumentList 'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','6412' `
  -WorkingDirectory 'L:\CODEX\treido-bg\apps\web' -WindowStyle Hidden `
  -RedirectStandardOutput 'L:\CODEX\treido-bg\.qa\shop-parity\preview.stdout.log' `
  -RedirectStandardError 'L:\CODEX\treido-bg\.qa\shop-parity\preview.stderr.log' -PassThru
```

Use unused log filenames when earlier evidence must be retained. Verify the new listener and a rendered Browser page; do not assume a returned process ID proves readiness. Reuse a healthy existing server. For other commands, invoke installed Node directly against the existing root Playwright/TypeScript/Prettier CLIs. Run source ESLint from `apps/web` so its actual configuration applies. Do not start dev and build in the same output directory concurrently.

In a second terminal with the same runtime and base-URL/browser environment, use the existing commands with the selected family and an honest run identifier:

```sh
node scripts/shop-parity/run.mjs enumerate
node scripts/shop-parity/run.mjs baseline --all --flows 14-16,40-41,96-97 --run YOUR_RUN_ID
node scripts/shop-parity/run.mjs compare-runs --before BEFORE_RUN --after AFTER_RUN
```

Run the relevant existing Playwright specs with the reference config. To use the confirmed preview already serving 6412, set `$env:REFERENCE_BASE_URL='http://127.0.0.1:6412'`; the harness validates loopback HTTP and does not start a second server. If using its separate development-server path instead, unset that override and use `REFERENCE_DEV=1`, which owns port 3103. Stop only the confirmed owned 6412 runtime before the separate harness uses the same `.next` directory, then restart the capture preview if needed. The default path without either override requires an existing production build. Do not mistake that default for the running dev preview.

`scripts/shop-parity/ledger.mjs` takes the recorded run ID as its positional argument when regenerating the dated ledger from real evidence. Do not regenerate acceptance from mere source definitions.

## Decide and act

Start with the [shared-component audit map](shop-implementation-map.md#shared-component-audit). For a related family, inspect every source control and variant, map it to its current component/state, and correct the common owner. Compare glyph ink and hit targets separately; include cards, headers, navigation, sheets, fields, selected/loading/disabled states, shadows and photograph boundaries. Preserve source-specific variants rather than adding global overrides from one screenshot. Then traverse the entire family in Browser and inspect sibling consumers. A broad inventory should produce immediate implementation batches, not consume a whole session without code.

Inspect ordered source and live pairs; fix the canonical owner. Exercise actual Back/Forward, overlays, keyboard, focus, scrolling and state persistence. Wait for the target UI state, fonts and decoded images. Verify related sibling states and relevant 320/430 widths before keeping a shared change.

Treat current access/permission failures precisely. Historical failures are dated evidence, not permanent claims that a tool or file is unavailable. Verify current permitted access without evading an actual denial. An unavailable computer is not proof that GitHub access is unavailable.

## Close a coherent batch

Run scoped checks, preserve original assertions and diagnostic thresholds, record exact source/run/evidence and update the owning task/flow records. Follow the root commit/synchronization contract and leave unrelated work untouched. Update the current resume note rather than appending another contradictory queue.

The browser/source gate is not payment, native or production acceptance. Missing proof is reported as not run or unresolved. Continue the next useful related work within the current request; do not ask the owner to approve routine component edits.

## New-session prompt

Copy the following into the next session in this same project:

```text
Continue implementing the ENTIRE frozen Shop buyer mobile-web UI/UX 1:1 in L:\CODEX\treido-bg. This is implementation work, not another plan or test-only pass. Preserve the current canonical checkout, branch and all local work; no new clone/worktree, framework upgrade, backend/native work, food rebrand or deployment.

Read AGENTS.md, product.md, docs/STATUS.md, Tasks 3/5/6 in tasks.md, then single-session-execution.md and the current checkpoint, shared-component audit map and open obligations in shop-implementation-map.md. Use the relevant parity/frontend/UI-verification skills and installed-version framework guidance. Do not reread the historical documentation library.

Application 2c74021 is current. Preserve 5820a40's Profile rail/settings spacing, bounded KITSCH photo/live border, Save controls, Support states, product controls and partial-word review truncation. 2c74021 finishes source-specific percentage-off/report-header variants and the Support draft composer. Earlier Search/checkout/confirmation, Orders and photo-answer repairs remain intact. Reuse the owned http://127.0.0.1:6412 development preview after verifying identity; do not assume the temporary 6413 production verifier remains running. Compare at 393x793, affected 320/430 widths and 467x853 store/cart.

All 97 flows / 424 ordered frames have mappings and evidence, not completed 1:1. The complete ledger is 5820a40 / 20260923-profile-review-complete: 78 numerical candidates, 346 above a threshold, zero replay/browser errors and 2.534671% mean MAE. Later 2c74021 / 20260923-source-snapshots-production covers 50/50 affected frames with no regression above 0.15. Production journeys pass 38/38, units 136/136 and the isolated production build generates 39/39 routes. The earlier full browser run passed 432/433; a test hydration/focus race was corrected and its family passes 7/7, also in production. Do not call this a final-source 433/433 run. All 755 frozen files verify; 307 standalone images are reconciled and 16 standalone videos have no audio. Three original-media failures, exact motion and named source/platform differences remain open; source approval is 0/97.

Work component-first and flow-by-flow. Scan every visible button/icon/card/field/header/dock/sheet/menu plus selected, disabled, loading and error variants in each source family. Map source frame -> current route/state -> canonical component -> discrepancy -> implementation -> evidence. Fix shared owners once, preserve real source variants, and check their sibling screens. Do not clone screenshot backgrounds with baked controls, invent hidden assets or substitute a nearby product/state. Reuse existing state/actions and complete navigation, Back/Forward, focus, scrolling, keyboard, persistence and cancellation.

Use up to three subagents for bounded independent audits and one source writer at a time. Continue unresolved typography/media and shared-control differences from the complete 5820a40 ranking, checking later 2c74021 scoped evidence first. Inspect full related sequences and siblings. Preserve connected state/history, source Cancel semantics, gallery 16px inset, reference-specific snapshots and unavailable-product boundaries. Recover pinned store-hero/shower-caddy/rice-shampoo originals and missing exact Chemical/Pura motion only through authorized sources. Latest Mobbin access requires a paid plan; do not bypass it. The eighth notification switch is visible but its title/copy remain dock-obscured in all downloaded sources; do not invent its identity. The implementation map owns the exact unresolved obligations.

Write real code in coherent batches. Visually compare each affected source sequence in Browser, then use existing scoped capture and interaction checks. Run types/lint as appropriate; avoid repeated full-suite/build runs after cosmetic edits. Keep masks, hashes, thresholds and meaningful assertions intact. Do not confuse passing tests or low average pixel error with 1:1.

Update shop-parity-checklist.md with flow-specific implementation/UX/width evidence and remaining exceptions as each family is completed. Keep shop-frame-ledger.md tied to a real complete run; record later scoped evidence in shop-implementation-map.md. Update docs/STATUS.md with exact commits, checks and next unresolved work. Do not create another backlog or mark acceptance on my behalf. Continue safe implementation without routine permission requests. Do not declare the entire app done while visible differences or incomplete app-owned flows remain.
```
