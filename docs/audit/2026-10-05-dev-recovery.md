# Development recovery and local-agent handoff — October 5, 2026

## Publication and ownership

This is a recovery receipt, not a T73 completion or production approval. Local and published application HEAD was `469f3513541ce3a812f557303aeed07ec177cc93` on `codex/astra-review-2026-10-05`; PR #1 remains draft and main is unmerged. The original executable tracker remains 16 DONE out of 66. Refresh Git before continuing. No new application commit or deployment was made by this recovery.

The interrupted delegated T73 worker was still running under PowerShell PID 34144. Its full command line identified the exact Treido T73 delegation. That worker and only its descendants were stopped. Unrelated Codex sessions and other project servers were not stopped. The dirty T73 lifecycle/export, billing recovery, dependency patch and concurrent Studio/admin-preview sources were retained, not reset or broadly staged.

## Reproduced failure and repair

Home entry, `/admin-preview`, `/sell/start` and `/account/privacy/closure` initially returned HTTP 500 with `Module not found: Can't resolve '@clerk/nextjs/server'`. The preview log also showed missing `@formatjs/icu-messageformat-parser`. Actual installed Clerk package/link targets were missing. The ordinary Node PATH selected 22.20.0, and the pnpm 10 launcher could not invoke its self-managed 12.3.4 executable shim. These were installation/launcher failures, not a reason to reset Clerk authentication.

Recovery explicitly selected installed Node 24.20.0 and the existing pnpm 12.3.4 `bin/pnpm.mjs` entry. It verified and stopped only the broken Treido Next process tree on 6418, then ran `install --frozen-lockfile --package-import-method=copy`. The install succeeded, restoring 167 package entries from the existing cache. SHA-256 checks confirmed no change to workspace/web package manifests, pnpm lockfile/workspace configuration or the three existing patch inputs. The installed pnpm package's own `install.js` restored its native Windows launcher; ordinary `pnpm.cmd --version` now returned 12.3.4.

Clerk server/localization, next-intl, Next, Vitest and ESLint module resolution succeeded. The canonical preview was restarted with `node apps/web/scripts/dev-preview.mjs --background`; the new launcher reported PID 51384 at `http://127.0.0.1:6418`. PID identity must be refreshed before any future process operation. Existing preview logs were preserved rather than cleared.

## Observed checks

All four previously failing HTTP routes returned 200 after normal redirects. Fresh guest Chromium sessions then waited for loaded Studio content and enabled controls: Studio home, Products and the business catalogue guide all returned 200 with zero page exceptions and zero observed same-origin HTTP 500 responses. Screenshots of the loaded pages are retained locally. The first screenshot caught Studio's loading state and was not used as loaded-content proof; a subsequent test initially selected the generic selling chooser instead of `?kind=business`, was corrected to the actual business route, and passed. This is preview recovery, not real signed-in/provider or visual-parity certification.

The current dirty-tree unit run completed with 2,026 passes, one failure and one original optional skip across 152 files. The failure was in the new braces source regression, which incorrectly required recursive compilation of a 4,000-level AST to fit every worker's stack. Recovery retained that exact input, verified all 4,000 parsed blocks iteratively, and retained the independent 50,000-level original stack-exhaustion assertion and patched-denial assertions. The complete three-file security/installed-consumer packet then passed all 64 checks. Do not relabel the earlier whole-suite run as a fresh all-green rerun.

Strict web TypeScript using `tsconfig.ci.json`, `--noEmit --incremental false` passed, without running type generation or changing the live preview output. Configured `pnpm ci:lint` passed with exit 0. PowerShell wrapped pnpm's stderr command echo as `NativeCommandError` text in the captured lint log; the actual lint exit code was 0 and no lint diagnostic was reported.

The initial native lifecycle/launch run completed: the existing 14 launch database cases and the new 0048 migration/grant case passed; 19 new lifecycle cases failed. Their common fixture sent the Clerk-style `app_T61Native` identifier as a job application ID, violating the existing lowercase job-event contract. Only that fixture namespace was corrected to `treido-t73-native`; production validation and Clerk identity were not relaxed. The focused rerun result is appended below when observed. Migration/grant success alone does not prove lifecycle behavior.

No new production build, hosted CI run, real email, payment effect, storage-provider acceptance or shared-database migration was performed. Published migrations 0001–0047 remain unchanged; uncommitted 0048 remains a draft. The last published audit still reported two high findings; local source patches are not upstream fixed releases or permission to suppress the audit.

## Local evidence

Evidence is under `app/apps/web/.qa/treido-preview-background/`: `recovery-units-20261005.log`, `recovery-types-20261005.log`, `recovery-lint-20261005.log`, `recovery-security-20261005.log`, `recovery-lifecycle-20261005.log`, `recovery-lifecycle-second-20261005.log`, `recovery-final-browser-20261005.json` and `recovery-final-*-20261005.png`. Preserve failures. The original `launcher.log` contains pre-repair errors followed by the new successful startup; old errors in that file are not evidence of a new failure.

## Local-agent continuation

Continue the current repository; read root/app/web AGENTS, the latest T73 claims in root `tasks.md`, this receipt and the actual current dirty diff. Finish existing work rather than introducing another broad architecture queue. One coordinator owns dependency installation, migrations/runner/grants, task receipts and Git publication. Give workers non-overlapping scopes and stop them before handoff. Do not touch unrelated Studio source without checking its current writer.

First keep the repaired preview usable. Prepend `C:\Users\radev\AppData\Local\nvm\v24.20.0` to the current process PATH, verify Node/pnpm pins, inspect the existing 6418 listener, and do not start duplicates. Never relink/install dependencies under a running preview. Never build/typegen into its output. Do not kill unrelated Node processes, delete recovery/database/private files, copy donor credentials or reopen authentication setup unnecessarily.

Finish T73's lifecycle migration, application paths and native/browser tests. Recheck raw-source cleanup versus protected processed attachments, SQL NULL versus JSON null resource identity, legal/report/commerce hold ordering against deletion, null/stale lease denial for both old personal-media and new message-image effects, current authorization, cancellation and truthful uncertain provider outcomes. Check that nullable `ownerKind` cannot bypass an existing personal-media condition through SQL three-valued logic. Export is a bounded own-authored metadata subset, not full message-content export; preserve counterpart/business privacy and older export snapshots/fixtures.

Review billing recovery and both `billing-crash-*.test.ts` files for seller/usage/intent/receipt lock order, exact invoice/request/hash/idempotency identity, microsecond claim ownership, concurrent retries and old delayed POST completion. Do not release money guards on a local timeout or invent terminal evidence for an ambiguous legacy portal session.

Read `app/patches/README.md` and run full source plus installed-consumer tests, not only the pre-install filtered test selection. Consult current primary advisories and qualify a real fix or supported dependency replacement. Preserve true versions and the unsuppressed audit. Keep retained native work unless an explicit product decision changes its scope.

Then reconcile every original executable package and finish remaining connected product work and intended integrations. Reuse existing approved Clerk/Neon/storage/Stripe/Inngest/mail resources and current receipts. Complete real signed-in buyer, seller, revoked/foreign member and operator journeys. Do not mistake preview fixtures for production data, fabricate seller consent/approval, send outreach or make real charges merely to close the counter. Record exact external prerequisites once and continue independent implementation.

After coherent fixes, run the repository's combined unit/lint/type/database/browser/production-build/output/smoke/audit checks with isolated outputs and actual source hashes. Read the final hosted result for the exact pushed head. Commit and push explicitly scoped verified work; no blanket staging. Merge main only when required checks and release acceptance genuinely pass. Keep automatic deployment disabled until the exact authorized cutover and rollback are ready. End with commit/PR state, exact package counts, actual tests, remaining named blockers, migration state and one working preview; leave no orphaned workers.


## Final observed recovery verification

The final sequential rerun completed with exit 0. The whole local unit suite passed **2,027 tests across 152 files, with one original optional skip**. These are current dirty-tree results, including unpublished T73 and Studio tests, not the published branch's historical 1,870 count. The final combined native packet passed **all 34 database checks: 20 new message-image lifecycle checks and 14 existing launch checks**. Its command finished normally; the subsequent scoped ESLint run on all three repaired test files also exited 0. Logs are `recovery-units-final-20261005.log` and `recovery-lifecycle-final-20261005.log` in the evidence directory above.

The intermediate lifecycle rerun had reached 19 passes and one failure: the negative recent-auth test called a synchronously throwing guard before its promise-rejection assertion could receive it. Wrapping the actual call in an async assertion preserved the `RECENT_AUTH_REQUIRED` denial and allowed the remaining export pagination assertions to execute. The final 20-case lifecycle run passes; earlier failures remain recorded rather than erased.

The independently completed strict web TypeScript and configured web/contracts/tooling lint both passed. The documentation checker, invoked from the correct `app/` workspace, passed with 66 executable packages and no errors. An earlier attempt incorrectly invoked that checker from the repository root and failed to locate the script; no product source was missing. The original executable table was re-counted at 16 DONE / 66, unchanged.

A fresh unsuppressed `pnpm audit --audit-level=high` was also actually executed during recovery and **still failed with two high findings**. Local mitigations and their 64 passing source/installed-consumer checks do not change that release result. No full production build or hosted CI was run on this unpublished tree.

The last warm checks returned HTTP 200 for Studio and the business catalogue guide. The preview listener was `127.0.0.1:6418`, child PID 52856 of the restarted launcher PID 51384; refresh process identity before any later stop. The prior delegated source writer is stopped. Source HEAD remains `469f3513541ce3a812f557303aeed07ec177cc93`, the index is empty, and all seven checked manifest/lock/patch hashes remain unchanged. The recovery, test fixes and this handoff remain local and uncommitted for the local coordinator to review together with their required draft dependencies. This finalizes the server-recovery work, not all T73 review concerns or the 66-package release.
