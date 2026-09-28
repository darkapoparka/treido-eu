> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Verification and evidence

Implement a coherent batch, then verify the risk it actually changes. Do not run a complete release suite after every edit. Existing code/fixture evidence, real-service proof, visual comparison and owner approval remain separate.

## Select the checks

| Change | Minimum relevant proof |
| --- | --- |
| Docs/agent skills/config | `node scripts/check-agent-docs.mjs`, upstream integrity check when vendored files change, `git diff --check`; inspect instructions and links. No application/browser suite solely for prose. |
| Buyer UI/flows | Scoped lint/types, relevant existing Playwright journeys, source/live comparisons and affected sibling/width checks |
| Shared contract/state | Consumer tests/types, serialization and affected web/native behavior |
| Money/stock/identity | Focused real PostgreSQL and sandbox/provider tests for concurrency, idempotency, permissions and failure, before the implementing batch closes |
| Merchant/CMS | Populated/empty and role/device journeys, persisted state, publish/rollback/conflict and public cache behavior |
| AI | Versioned representative evals plus tool authorization/schema/approval tests, cost/latency/failure bounds |
| Native | Declared installed development builds/devices, lifecycle/deep-link/keyboard/permission/provider-return coverage |
| Release | Integrated exact-source matrix, isolated recovery rehearsal and explicit live authorization |

Documentation checks do not replace application checks when a runtime source, test harness or deployment setting changes. A CI trigger-only change needs workflow structure/branch-condition review; any application suite it launches reports its own actual status.

## Evidence format

Record task/family, source commit or clearly identified dirty-work snapshot, command, actual result, environment/data, platform/viewport and evidence path. Note which prerequisites failed and which steps did not run. Unit mocks, real database tests, browser emulation, physical devices, hosted previews and production are different evidence classes.

Use synthetic/reviewed data and isolated state. Do not publish tokens, auth traces, personal records, signed URLs or restricted source exports. A skipped suite, route response, screenshot capture or signed-out redirect is not a successful flow. Existing failures do not become fixed through a documentation commit.

## Shop source proof

Use the unchanged frozen manifest and existing recipes/runner. Inspect ordered source frames, wait for the real target state, fonts and decoded images, capture at the declared viewport and inspect pairs/overlays/differences. Source matching is different from regression against our own output.

Keep every frame even when multiple frames share pixels or a route. Route hints are not executable coverage. Numeric MAE/bad-pixel diagnostics do not replace visible quality or interactions. Never hide app-owned differences with masks, substitute rejected assets or update expected hashes merely to pass. [design.md](design.md) owns the exact normalization and thresholds.

A source-approval gate is scoped to the frozen buyer reference and platform exceptions. Real-service readiness is an independent gate. Task 7's branding requires source approval; it must not falsely mark backend/native/merchant work complete.

## Critical boundaries

Commerce acceptance includes competing buyers for last stock, changed quotes, expiry/payment races, duplicate submissions/callbacks, interrupted returns, out-of-order events, partial/full refunds and uncertain provider outcomes. Use approved DEC-002 examples and real isolated transaction tests, not only mocked button state.

Permission checks include another user's/business's IDs, revoked membership, stale workspace context, unauthorized exports/files/subscriptions and a merchant attempting platform operations. Test the owning service or endpoint, not just a menu.

CMS acceptance includes draft isolation, unsafe content rejection, tenant-safe media, concurrent edits, failed publish, immutable versions, rollback under current product policy and public cache invalidation. AI acceptance includes unsupported food claims, cross-tenant/injected content and reauthorization after approval.

## Quality and release

Test applicable loading/empty/error/retry/forbidden/offline states, BG/EN and long content, accessible labels, keyboard/focus, reduced motion and representative responsive widths. Full product review covers the matrix in [detailed acceptance](docs/engineering/verification-detail.md), including real-device and performance evidence; an emulated viewport is not a physical-device claim.

Measure production builds with realistic synthetic data and stated device/network/cache conditions. Keep targets distinct from measurements. Verify backup/restore, provider reconciliation, contract compatibility and rollback before public release. Source code being pushed is not deployment authorization; app submission is not store approval.
