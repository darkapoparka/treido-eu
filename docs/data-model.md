# Data model, constraints and migrations

Physical-schema blueprint for `GLOBAL-DATA` and all marketplace features. The initial [identity/draft migration](../app/apps/web/migrations/0001_identity_drafts.sql) implements users, seller accounts, personal ownership, business membership, Free draft usage, listings, private draft payloads and save receipts. The additive [seller setup migration](../app/apps/web/migrations/0002_seller_setup.sql) adds human signup preferences, public business profiles, revisioned business setup progress, private declaration snapshots and scoped setup receipts. [Durable jobs](../app/apps/web/migrations/0003_durable_jobs.sql) adds outbox intents, claimed/completed effects and immutable redrive audit. [Draft media](../app/apps/web/migrations/0004_listing_media.sql) adds owned upload intent, pinned input, processing state and private derivatives. [Drizzle schema](../app/apps/web/src/server/db/schema.ts) owns their application types. The original migrations and additive publication/inbox/duplication migrations are exercised on owned UTF8 native PostgreSQL, not applied to Neon. Remaining tables are blueprints. Implement them by the consumer tasks in [tasks](../tasks.md); [backend](backend.md) owns execution and [API](api.md) owns entry contracts.

The additive catalogue, participant/report, moderation and withdrawal migrations (`0005`–`0008`) persist versioned pending category policies, thread sequence/attachment ownership, explicit operator grants, reason/revision audit, appeals and immutable withdrawal receipts. Runtime cannot edit policies, grant itself operator authority or rewrite accepted messages/audit/withdrawal receipts. These additions are exercised only on owned native PostgreSQL; intended Neon qualification remains separate. Blueprint sections below describe the broader target beyond these implemented tables.

## Accepted listing snapshots — T39

`0011_listing_publications.sql` adds `listing_publications`, `listing_publication_media` and the listing's current-publication pointer. Accepted payload, handover/rights declarations, category-policy/declaration revision and ordered media checksums/dimensions are immutable to the runtime role. Composite foreign keys prevent another seller's listing, declaration or photo entering a snapshot. Gallery identity is bound to both accepted publication revision and asset revision; object-storage keys remain in the private media table.

The migration does not expose older rows by backfilling a publication from arbitrary draft state. All new public queries require an accepted snapshot. Existing participant/moderation integration fixtures explicitly seed that additional accepted state; the new publication suite instead runs actual create/upload/Sharp-processing/publish commands. A narrow fixed-search-path lock function lets a runtime publisher hold a current category-policy row without gaining update/approval permission.

Free active slots are serialized on the existing seller-usage row and counted from current published listings. Retained draft-storage usage is unchanged by publication. Withdrawal frees an active slot but preserves the accepted snapshot and messages; edits to a withdrawn draft cannot become public until a new acceptance. No stock, payment, order or automatic seller-approval table is implied by this migration.

## Common conventions

Opaque stable IDs; UTC `timestamptz`; ISO country/currency codes; supported BG/EN locales with explicit fallback. Money is integer minor units, a currency, and bounded arithmetic; no floating-point calculation or unsafe bigint-to-number serialization. Attribute decimals have explicit units/precision. Public handles are normalized and uniquely indexed; private emails/addresses/provider identifiers never enter public listing projections.

Use foreign keys, uniqueness, checks, transactional commands and explicit indexes for invariants. Each mutable aggregate has an optimistic `revision`. History records capture the accepted version rather than following current product/profile/price fields. Soft withdrawal/closure is distinct from policy-governed personal-data erasure. No blanket cascade deletion of orders, financial or recovery evidence.

## Identity and seller ownership — T04/T10

| Entity                    | Essential fields and constraints                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                   | unique Clerk subject, private contact/preferences, locale, restriction/closure state; identity comes from verified server session                  |
| `seller_accounts`         | kind personal/business, public handle/name/profile, owner relationship, lifecycle, revision; stable seller ID; no ordinary kind/ownership mutation |
| `personal_seller_owners`  | unique user and unique seller pair; guarantees at most one personal seller for each human                                                          |
| `seller_memberships`      | seller/user unique, role/capability grant, active/revoked state, audit revision; current membership checked on every private use case              |
| `seller_invitations`      | seller, intended verified identity, hashed single-use token, expiry, reserved seat, inviter; acceptance/expiry/revocation atomic                   |
| `seller_declarations`     | versioned trader/legal/consumer disclosures, submitted/review status, private evidence; no paid-plan substitution                                  |
| `verification_claims`     | subject, exact claim, issuer/evidence reference, validity/revocation; project public claims through an allowlist                                   |
| `seller_payment_accounts` | seller, provider/environment/account ID, current capability/readiness state; unique mapping; no browser-authored readiness                         |
| `operator_grants`         | user, narrowly scoped operator capability, validity/revocation and restricted audit; separate from business membership                             |
| `seller_onboarding_progress` | seller/workflow version, optional last step/dismissed tips and revision; navigation state only, never publication/payment authority |

Implemented setup writes lock the current human/seller/membership before checking the aggregate revision. Declaration edits append snapshots; runtime roles cannot update declaration snapshots or setup receipts. Submission can request review only; accepted/rejected review is a future separately authorized operator command. Collection version `1` is not a reviewed legal publication policy. Public profile fields exclude private legal/contact data. Setup navigation, signup preference and a submitted declaration do not authorize publication, checkout or payouts.

Creating user/personal seller is idempotent. Business creation and initial owner membership commit together. Owner removal/role changes lock the membership set and protect the last active owner. Operating-context preference grants no permission. A user's paid plan is seller-scoped, while legal data access and buyer AI budgets remain human-scoped.

Setup answers belong in seller/declaration/fulfilment/payment records; the progress row does not duplicate their truth. `SellerReadiness` is a derived per-operation view with stable reason codes, specified in [seller workspace](seller-workspace.md). Required policy versions and provider observations have timestamps/revisions; stale readiness is not a publish or payment grant. Keep human signup intent separate from seller setup, and never use Clerk's active organization as a seller foreign key.

## Catalogue, drafts and media — T06/T23/T24/T25

Implemented draft `media_assets` belong to an explicit `(seller_id, listing_id)` pair. Intent owner, request/hash, claimed length/type/checksum and staging key are immutable to the runtime role. A listing lock serializes the 12-photo cap and ordering; every reorder/removal checks all asset revisions. Processing state and its matching seller/job reference commit with the outbox intent. Ready media require frozen input, derivative checksum and bounded dimensions; removal is a soft detached state and cancels unfinished work. This draft implementation stores gallery position on the asset. Public attachment/publication eligibility, rights approval and retention/cleanup remain separate consumer work; no public `listing_media` relation is claimed implemented.

| Entity                                        | Essential fields and constraints                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`                                  | immutable seed ID, parent, slug, BG/EN labels, lifecycle/order/version; unique sibling slug; acyclic ancestry; [registry](categories.md)                                                                   |
| `category_policies`                           | leaf/country/version, enabled state, allowed item/condition/seller/fulfilment/purchase modes, limits and attribute profile                                                                                 |
| `attribute_definitions` / `attribute_options` | key/type/unit/bounds, applicable leaves, required/filterable flags, versioned option IDs; no unconstrained public enum creation                                                                            |
| `listings`                                    | immutable seller ID, selected leaf, current revision, title/description, condition/defects, price/currency, locality, inventory/purchase modes, independent publication/moderation/availability dimensions |
| `listing_drafts`                              | listing identity, seller, draft payload/revision/schema version, last acknowledged save; duplicate request/revision conflict rules                                                                         |
| `listing_attributes`                          | validated definition/value per listing/revision; scope and type validated against current leaf policy                                                                                                      |
| `listing_revisions`                           | immutable snapshots needed for accepted agreements, review/audit and material edit history; retention is explicit                                                                                          |
| `media_assets`                                | owner/seller, opaque object key, actual MIME/dimensions/size, upload/scan/process state, visibility, expiry and rights assertion                                                                           |
| `listing_media`                               | listing/asset/order/role; attaches only ready, currently owned assets; stable gallery order and accessible descriptions                                                                                    |
| `inventory_skus`                              | listing, unique option combination, seller SKU, amount/currency override, inventory mode, on-hand/sold/reserved quantities, revision; nonnegative checks                                                   |
| `inventory_allocations`                       | listing/SKU, buyer/offer/order, positive quantity, expiry/state; unique source request and active unique-item ownership constraints                                                                        |
| `inventory_events`                            | receipt/adjustment/reservation/release/sale/reversal, actor and source key; append history sufficient to reconcile stock                                                                                   |
| `import_jobs` / `import_rows`                 | seller, source object, mapping/version, resumable state/cursor; unique row key/hash and resulting draft ID; bounded errors                                                                                 |

Unique items use one SKU and quantity one; stocked listings expose only supported option combinations. The seller cannot change inventory mode, seller ownership or currency under an accepted allocation. Stock adjustment cannot lower stock below currently reserved/sold obligations. Restock is explicit after a return/refund and item inspection.

Media workflow: authorised intent → private upload → validation/scan/processing → ready → attach/publish. Private draft objects do not become public because their keys are guessable. An upload receipt cannot fake ready state. Cleanup selects expired unbound objects by durable ownership; it does not recursively delete an arbitrary user's folder.

Child rows carrying a seller ID must reference a matching owned parent, using composite uniqueness/foreign keys where appropriate. Draft/category edits retain category-policy version and expected revision; membership checks are repeated under the mutation's transaction locks. An uploaded object's checksum/immutable processing key binds approval to the exact bytes; a reusable upload URL cannot mutate a ready derivative.

## Discovery and communication — T07/T08/T09/T15

| Entity                                                 | Essential fields and constraints                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `saved_listings`, `seller_follows`                     | unique human/resource pair; private user scope; retention respects removal/private visibility                                       |
| `collections` / `collection_items`                     | owner, private default, ordered references; public sharing requires its own visibility policy                                       |
| `saved_searches`                                       | owner, validated filter version including seller kind, notification consent/frequency; no arbitrary serialized SQL                  |
| `conversation_threads`                                 | listing, buyer, seller, lifecycle; unique participant/listing identity for ordinary initial contact                                 |
| `messages`                                             | thread, authenticated author, body/attachment refs, client request key, sequence/time, edit policy; unique dedupe key               |
| `conversation_read_cursors`                            | thread/user unique, last read message; cannot move backwards accidentally on reconnect                                              |
| `user_blocks`                                          | blocker/blocked pair, scope/reason; enforcement is server-side across sending and notifications                                     |
| `offers` / `offer_events`                              | thread/listing/revision, proposer and parties, amount/currency, expiry/status, accepted terms/allocation; no browser-only agreement |
| `notification_preferences` / `notification_deliveries` | consent/topic/channel and dedupe key/state; revocation checked at delivery                                                          |

Thread access requires current participant or explicit seller-inbox capability. Removing a staff member immediately denies attachments and message history, even if they retain an old URL. Message content cannot become agent instructions. Search/assistant projections never include private threads or seller contacts not approved for public disclosure.

## Orders, payments and settlement — T11/T12/T13

| Entity                                    | Essential fields and constraints                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quotes` / `quote_lines`                  | buyer, seller, currency, item/SKU/quantity/revision and accepted offer, shipping/fees/tax/terms snapshot, validity; immutable signed server meaning  |
| `orders` / `order_lines`                  | buyer/seller/currency, quote and allocated stock, immutable item/seller/amount snapshots; one seller/currency per order                              |
| `order_fulfilments` / `fulfilment_events` | permitted method, scoped address/collection detail, carrier refs/tracking, explicit transitions and dedupe                                           |
| `payment_attempts`                        | purpose item/subscription/promotion, intended resource/account/environment, stable idempotency key, amount/currency, pending/reconciling/final state |
| `provider_receipts`                       | provider/account/environment/event unique, authenticated receipt, object correlation, processing/error state; restricted payload retention           |
| `refund_attempts`                         | order/payment, amount/currency, reason, stable key, pending/reconciling/result; atomic remaining-refundable bound                                    |
| `refund_lines`                            | attempt/order-line, quantity and frozen amount/fee/tax allocation; concurrent partial refunds cannot exceed line quantity or payment balance         |
| `cases` / `case_events`                   | order/participants, reason/evidence, operator/reasoned decision and appeal; access-limited history                                                   |
| `ledger_transactions` / `ledger_entries`  | append-only balanced postings per currency, provider/source identity, reversal links; buyer sale and seller subscription revenue distinct            |
| `settlement_attempts`                     | seller/order, eligible amount, hold/release rationale, provider transfer/payout refs, reconciled state                                               |
| `purchase_reviews`                        | eligible completed order/reviewer unique; rating/content/moderation state; seller-reported sale cannot qualify                                       |

Payment, order, allocation, fulfilment and settlement each have separate status. A duplicate webhook cannot post a second ledger transaction. A late payment after allocation loss blocks fulfilment and enters compensation, including reversal/reconciliation of any already executed transfer; it cannot confiscate another buyer's item. Destination transfers and bank payouts have distinct identities/states as specified in [billing](../billing.md). Tax/legal accounting is qualified against the actual seller/platform entity; schema presence is not certification.

## Plans, promotions, AI and operations — T13/T15/T26/T27

Implemented `outbox_jobs` store opaque resource/actor IDs, immutable intent/hash and kind/operation key, generation, dispatch attempts/lease, executor acceptance, progress and terminal state. `job_effects` share the exact job/kind/operation identity and persist the execution lease and result identity; replay does not create another effect. Runtime roles can update only lifecycle/result columns. `job_redrives` append service identity, reason and expected generation transition; they cannot be updated by the runtime role. Delayed events from an earlier generation cannot run a redriven job. Expired leases represent an unknown outcome requiring the consumer's stable provider key/reconciliation.

| Entity                                       | Essential fields and constraints                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan_versions` / `plan_entitlements`        | immutable catalogue code/version, limits/features, price mappings by environment/currency; [billing](../billing.md)                                      |
| `seller_subscriptions`                       | seller/provider subscription unique, plan version, verified service interval, lifecycle/revocation; server time is authority                             |
| `seller_usage` / `usage_events`              | reconcilable active listings/drafts/seats/import/export usage; conditional updates in the consuming transaction                                          |
| `promotion_products` / `promotion_campaigns` | versioned product/placement/price, owned listing, seller scope/category/country, purchase/serving interval, reason-specific stop/credit policy           |
| `promotion_delivery_events`                  | campaign/listing/request/placement key, eligible impression/click provenance and dedupe; excludes bots/test traffic by policy                            |
| `assistant_runs` / `assistant_events`        | human, optional operating seller, tool identity, visible constraints, prompt/model/tool versions, cited IDs, cost and outcome; privacy-limited retention |
| `assistant_budget_reservations`              | human/window/request key, reserved/actual usage, shared counters and reconcile state; seller switching cannot reset usage                                |
| `reports` / `moderation_actions`             | reporter/resource/reason, restricted evidence, state, authorised decision/appeal; enforcement shared by every public projection                          |
| `idempotency_records`                        | actor/operation/resource/key unique, input hash, pending/result; conflicting reuse is rejected                                                           |
| `outbox_jobs`                                | effect type/resource/version, stable dedupe key, lease/attempt/next retry, completed/reconciling/error state                                             |
| `audit_events` / `measurement_events`        | restricted authority change log / minimised commercial event facts, version and provenance; public dashboards use aggregates                             |

Only create the tables needed by a task. Logical entities may share a table when their constraints/lifecycle justify it; do not generate a universal repository/service layer from this catalogue.

For T04f, outbox records additionally distinguish pending handoff, executor-accepted and effect-completed; record executor run ID, last progress/error class and reclaimable dispatcher lease. A separate per-consumer effect receipt or the existing domain attempt provides unique `(consumer, operation_key)` and provider-object correlation. Event acceptance alone cannot set a payment, upload or email to completed. Sensitive payloads stay in their restricted feature tables, not duplicated into executor events/results.

## Transaction and race contracts

1. Publish locks the seller usage row and draft/listing in a documented order, checks current authority/revision/policy/media and consumes at most one active slot. Retry returns the same listing/result.
2. Offer acceptance and checkout call the same allocation use case. Lock SKUs in stable ID order, enforce expiry with database time and allocate through conditional update/constraints. The transaction commits intent before Stripe is called.
3. Stocked checkout allocates each line atomically or none; a partial cart cannot be silently charged. Unique items admit one winner. Expired release and late confirmation use legal state transitions under the same locks.
4. Seats/invites, quota downgrade, refunds, promotions and AI budget reservations have analogous atomic ownership/usage checks. UI button disabling is additional feedback.
5. Domain transition and required outbox job commit together. External provider work runs outside locks with a stable key; unknown outcome is reconciled before a new effect is allowed.

## Query indexes and migration proof

Initial public indexes cover eligible publication, category ancestry, seller kind, seller ID, locality/country, price/currency and `(published_at,id)` pagination. PostgreSQL lexical/model/transliteration matching is measured against representative BG/EN data; no speculative vector-only replacement. Private indexes cover current membership, thread sequence, user saves, seller orders, job leases, webhook identity and allocation expiry.

Measure real query plans and pool pressure before extra indexes/services. Product reads select allowlisted columns and bounded related records. Raw identifiers in a schema do not grant access. Runtime and migration roles differ; any RLS is explicit defence in depth, with isolated tests of the actual runtime context.

Migration evidence includes fresh install, previous-schema upgrade, duplicate/replayed seed, orphan/cycle prevention, two-user/two-seller denial, simultaneous last-slot publish/seat/allocation/refund and restore reconciliation. Rehearse compatible forward fixes and isolated restore. Do not apply a destructive rollback to undo external charges.

## Implemented inbox extension

Migration `0010_inbox_controls.sql` adds `contact_preferences` keyed by seller/buyer, independent buyer/seller block flags and an optimistic revision. Existing conversation pairs are backfilled before the composite foreign key is applied. Contact mutation receipts are immutable and bound to pair, actor and request.

Threads now maintain `last_message_at` with buyer/seller activity indexes. `conversation_read_cursors` stores monotonically advancing sequence positions per thread/human, so one employee's read does not erase another's unread state. `message_notification_intents` stores one content-free recipient-side intent per persisted message and is not a claim of external provider delivery. Runtime cannot rewrite accepted contact/notification receipts. Previous migrations are unchanged; the native database suite exercises atomic application, rollback, replay, permissions and buyer/business isolation.
