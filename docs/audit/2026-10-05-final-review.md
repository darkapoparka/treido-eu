# Codex implementation acceptance review — October 5, 2026

This is a frozen review of the existing implementation, not a new task queue. Root [tasks](../../tasks.md#executable-work-packages) remains authoritative. Entry review head was `469f3513541ce3a812f557303aeed07ec177cc93`; main was `76c1e71af2c92e1d3cecde85efdd7de7e7ea84ab`. The previous Codex batch delivered substantial source for independent review, not an approved production launch. Its historical 1,747-unit/189-database results do not imply that 51 features were missing, or that every live integration was finished.

## Accepted work and actual repairs

T06a's original draft-persistence scope is accepted after source review and three fresh native PostgreSQL scenarios: durable edits through a separate connection, exact-request replay and stale/changed-request rejection, foreign/revoked-member denial, invalid category rejection and two concurrent commands competing for the final Free draft slot. The implementation already existed; this review did not rebuild it. Live identity/provider/release acceptance stays with its owning T04/T06b/T16 packages.

The released T73 implementation contains sent-image lifecycle/export, billing crash recovery and local dependency source mitigations. Review repaired three related lifecycle defects: an unclaimed legacy effect could acknowledge success using SQL NULL lease values; optional-data removal had the same missing-lease problem; and a blanket linked-object exclusion prevented original raw-upload cleanup. Draft 0048 now requires actual current tokens/deadlines/attempts, including legacy session/data paths. Registered raw sources expire without deleting the processed message image. Existing published 0001–0047 sources were not edited.

Observed local verification: 23 lifecycle PostgreSQL cases pass, including three new null-lease/raw-source regressions; 18 billing crash-recovery PostgreSQL cases pass; the 14 existing invitation/image launch cases pass; the three draft acceptance cases pass. The six BG/EN disclosure browser cases pass at 320/390/1440 pixels and 200% text. These are explicit local test identities/provider adapters, not actual Clerk/Stripe/storage acceptance. The billing crash packet is also selected by the ordinary unit pattern; repeated execution is not additional unique coverage.

The first new native run rejected a malformed SQL replacement before its lifecycle cases ran. A JavaScript replacement interpreted a literal dollar-quote pattern; the draft function was reconstructed with literal-safe replacement, and all 23 lifecycle cases then executed successfully. That failed log remains local. The configured CI now runs the original launch tests plus lifecycle, draft and native billing recovery, and the disclosure browser checks. Exact published-source unit/build/output/smoke/audit outcomes belong to the final hosted run on PR #1, not a prediction in this report.

## Reconciliation of all 66 original packages

The table distinguishes existing source from final acceptance. `Accepted` means the original bounded task is closed, not that the whole platform has launched. `Implemented / open` means substantial relevant implementation exists but its named acceptance is not complete. Conditional upgrades are not mandatory missing product features. Repeated task-family IDs and T40–T73 receipts are not extra executable tasks.

| Package | Review classification | Existing implementation / exact remaining acceptance |
| --- | --- | --- |
| T31 | Accepted | Root/owning documentation contracts, agent routing and documentation checker. |
| T01a | Accepted | Pinned clean installation/build and reference rejection already qualified. |
| T02a | Implemented / open | Hosted functional CI exists; the unsuppressed dependency gate remains red. |
| T02b | Implemented / open | `app/patches` has version-preserving source mitigations and actual consumer regressions; these are not official patched releases or an audit waiver. |
| T02c | Conditional | Tooling patch batch only on a measured need; do not upgrade merely to close a row. |
| T02d | Conditional | Deliberate major/native peer migration requires a product need, not launch bookkeeping. |
| T04a | Implemented / open | `server/config`, Clerk/Neon/Inngest mappings; actual intended media binding remains missing locally. |
| T04e | Accepted | Seller capability, readiness and continuation policies. |
| T04b | Implemented / open | Identity/database adapters and restricted grants exist; real two-human/two-business acceptance and production credential separation remain. |
| T04c | Implemented / open | Intent and saved seller onboarding/declarations; actual signed-in reload/change journeys remain. |
| T04d | Implemented / open | Private seller layout/switch/checklist/editor; real session-switch and rendered merchant acceptance remain. |
| T04f | Implemented / open | Durable outbox/Inngest executor exists and has historical cloud proof; current reachable signed callback and actual feature execution remain. |
| T05a | Accepted | Canonical browse/filter/cursor parsing. |
| T05b | Accepted | Personal/business/all browse control and navigation. |
| T23a | Accepted | Versioned bilingual category/attribute registry. |
| T23b | Accepted | Category picker and typed fields. |
| T23c | Implemented / open | Persisted catalogue/policy checks exist; genuinely reviewed launch leaf policies are not invented by migrations. |
| T23d | Accepted | Scoped category preparation polish. |
| T06a | Accepted in this review | Actual draft persistence, current ownership, replay/revision and quota-race acceptance described above. |
| T06b | Implemented / open | Private listing upload/processing and storage adapters; actual intended storage/CORS/cloud/browser qualification remains. |
| T13a | Implemented / open | Free limits and entitlement/counter locking exist; complete downgrade/usage acceptance is not inferred from one draft-slot check. |
| T09a | Implemented / open | Conversation/report persistence and scoped participant/operator checks; complete connected attachment/current-session acceptance remains. |
| T09c | Implemented / open | Reports, moderation, decisions and appeals exist; real operator and attachment workflow acceptance remains. |
| T06c | Implemented / open | Immutable publication, withdrawal and republication exist; actual media, declarations/rights and reviewed policy acceptance remain. |
| T06d | Implemented / open | Listing index, saved-content duplication and bounded bulk controls exist; complete real-session merchant checks remain. |
| T07a | Implemented / open | PostgreSQL public discovery/facets/paging exists; positive legitimate hosted inventory and rollout acceptance remain. |
| T07b | Implemented / open | Accepted detail/photos/contact/report/metadata exists; intended-media and real-supply qualification remains. |
| T07c | Implemented / open | Public seller/store/search/info and feedback projections exist; real supply and rendered acceptance remain. |
| T07d | Accepted | Bilingual locale negotiation and buyer controls. |
| T08a | Accepted | Durable saves, collections and follows; not just device storage. |
| T09b | Implemented / open | Inbox/replies/read/block/notifications and image intake/delivery exist; actual provider and signed-in message journeys remain. |
| T10a | Implemented / open | Capability-safe invitations and Resend delivery/recovery exist; intended verified sender and delivered test invitation remain. |
| T10b | Implemented / open | Saved business settings, private preview, team and inbox composition exist; real two-business isolation acceptance remains. |
| T10c | Integration acceptance | Join the existing real merchant modules in the full signed-in loop. Fictional `/admin-preview` interactions are not backend completion. |
| T24a | Accepted | Stock/SKU/variant commands and definition constraints. |
| T24b | Accepted | Common atomic stock allocation and late-settlement seam. |
| T24c | Accepted | Variant/current-stock selection, durable cart and seller stock controls. |
| T11a | Accepted | Structured offers/counters and durable negotiation history. |
| T11b | Accepted | Exact accepted-offer allocation/quote handoff. |
| T12a | Implemented / open | Connect onboarding/readiness adapter exists; intended sandbox/account/country/funds-flow approval remains. |
| T12b | Implemented / open | Frozen multi-line quotes, attempts and idempotent checkout exist; actual sandbox and current-user acceptance remain. |
| T12c | Implemented / open | Signed raw webhook/deduplication/jobs/reconciliation exists; real callback and provider-race proof remains. |
| T12d | Implemented / open | Orders, dispatch/pickup, history, notifications and completed feedback exist; real fulfilment/payment acceptance remains. |
| T12e | Implemented / open | Aftercare, bounded partial/full refunds and settlement observations exist; actual sandbox reconciliation remains. |
| T13b | Implemented / open | Billing catalogues/checkout/pending updates/invoices and crash recovery exist; actual approved catalogue and legacy opaque-session resolution remain. |
| T13c | Implemented / open | Real usage/insights/exports/invoice consumers exist; actual current-role/provider acceptance remains. |
| T25a | Implemented / open | Bounded private CSV chunks, validation and row review exist; real authenticated intake/worker acceptance remains. |
| T25b | Implemented / open | Durable imports/cancel/resume and bulk stock/export exist; actual cloud executor delivery remains. |
| T26a | Implemented / open | Promotion eligibility/capacity/labels/selection exists; approved catalogue and rendered delivery acceptance remain. |
| T26b | Implemented / open | Separate promotion payment/effects/expiry/remedy flows exist; actual intended sandbox/placement qualification remains. |
| T15a | Implemented / open | Allowlisted tools, provider adapter, budgets and evaluation infrastructure exist; real provider cost/voice reconciliation and BG/EN evaluations remain. |
| T15b | Implemented / open | Find/Deal/Compare and real filtered catalogue queries exist; grounded current-session/rendered acceptance remains. |
| T15c | Implemented / open | Private voice/photo input, Photo Match and Gift Finder exist; actual processing/privacy/cost and rendered acceptance remain. |
| T15d | Implemented / open | Deterministic Compatibility and draft-only Sell Helper exist; current human/draft acceptance remains. |
| T15e | Implemented / open | Saved criteria, generations, durable matching, opt-out and in-app alerts exist; current cloud/feed acceptance remains. External push/email alerts are not claimed implemented. |
| T14a | Implemented / open | Bounded query/index/payload code and earlier finite measurements exist; representative dataset/environment performance is not established. |
| T14b | Conditional | Cache/index changes only for a measured bottleneck; no mandatory framework rewrite. |
| T14c | Performance acceptance | Representative full-journey responsive/performance checks and resulting concrete bottleneck fixes remain. |
| T27a | Implemented / open | Restricted operator/case/support controls exist; real operator and exceptional-state workflows remain. |
| T27b | Implemented / open | Preferences/security/export/closure and image extension exist; irreversible-I/O hold race below still needs qualification/fix before activation. |
| T27c | Implemented / open | Job observations and isolated restore evidence exist; current external-effect recovery, named alert ownership and operational qualification remain. |
| T28a | Accepted | Bilingual onboarding/CSV/support/acquisition materials and truthful measurement definitions. |
| T28b | Real supply | Consenting sellers, rights-cleared photos/stock and declarations require actual onboarding; fixtures cannot satisfy this. |
| T16a | Release acceptance | End-to-end provider/current-user/evaluation/visual/recovery matrix remains; not another missing feature architecture. |
| T16b | Cutover preparation | Exact environment/domain/catalogue/migration/backup/rollback packet for the approved release remains. |
| T16c | Production acceptance | Authorized production rollout and actual smoke/operations handover have not occurred. |

After T06a acceptance: **17 accepted; 40 with implementation but open acceptance; three conditional changes; six integration/performance/supply/cutover packages. Total 66.** This is neither 49 unwritten features nor a claim that all existing source is ready to activate.

## Finite outstanding findings for Codex

1. **Message-image hold versus irreversible I/O:** `features/account-closure/effects.server.ts` currently commits its `account_message_image_io` check before the external request. The new native tests prove that a hold blocks acknowledgement; they do not prove that a concurrently committed hold prevents an already-running DELETE. Add a real independent-connection/deferred-storage reproduction and implement a coherent ordering/recovery protocol covering message/report/commerce/legal holds and expired/lost effect leases. Do not mark data preserved merely because recording success was denied. Relevant SQL is now published 0048; any later schema repair must be additive, not a rewrite.
2. **Legacy billing portal change:** `features/seller-billing/recovery.server.ts` safely handles new pending-update/invoice attempts and stale claim recovery. An old opaque portal session still needs authoritative terminal recovery or an explicit supported operator resolution path; a browser timeout cannot release its money guard.
3. **Actual intended bindings and acceptance:** local configuration presence confirms DB, Clerk and Inngest declarations, not a need to restart their setup. This read found no `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, R2 credentials, `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`, or `RESEND_API_KEY` under those names. Existing external resources may still exist; inspect approved resource IDs and private binding procedures. Complete intended media/CORS/worker, invitation delivery and sandbox checkout/refund/billing/promotion journeys, then real buyer/two-business/operator browser loops. Do not print keys or repeat a denied credential transfer.
4. **Assistant/runtime and representative acceptance:** run the existing BG/EN evaluation corpus against the intended approved runtime, qualify voice/provider usage accounting and unknown-cost recovery, and complete representative performance plus named operations/alert/restore acceptance. Report actual defects from those runs, not a new full architecture plan.
5. **Security gate:** the raw audit continues to report node-forge 1.4.0 and braces 3.0.3. Their local source mitigations preserve true versions and exercise actual consumers. A supported dependency solution or an explicitly approved patch-aware release decision is still required; hiding advisories, falsifying versions or silently reducing audit scope is not a fix. This is distinct from whether source can be committed to a non-deploying review branch.

Concurrent Studio files are preserved and excluded from this publication. Their author must release the exact diff for review; they are not silently discarded, approved or represented as real provider-backed operations. Final commit/head/CI status is recorded in PR #1 and the final task receipt. No new provider action, shared migration, paid resource or production deployment occurred in this review.
