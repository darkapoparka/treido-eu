# Query, command and provider contracts

September 30, 2026. Target contracts, not a list of existing working endpoints. [Architecture](../architecture.md) owns transport choice; [backend](backend.md) owns enforcement. Use Server Actions for web-owned commands and server queries for pages. Add Route Handlers only for streaming, upload/provider HTTP boundaries and subsequently required native integrations. Retain `/products/[id]` and `/stores/[id]` until a scoped route migration.

## Shared boundary

Server derives actor from the verified session, then validates bounded input, checks current resource/seller authority, executes the use case and returns an allowlisted projection. Client-provided `sellerId` identifies a requested operating context; it never proves permission. Public `seller` filters never select the operating account.

Mutations carry `requestId` and `expectedRevision` when the resource is mutable. Idempotency scopes to actor/operation/resource, stores an input hash and returns the original outcome for equivalent retries; mismatched reuse conflicts. Payment/provider retries have their own persisted stable key. Result discriminants are `ok` plus data/revision or an error: `UNAUTHENTICATED`, `INVALID_INPUT`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `QUOTA_EXCEEDED`, `RATE_LIMITED`, `NOT_AVAILABLE`, `PENDING`. Forbidden/not-found handling must not reveal another seller's private existence.

Development starting bounds: public page 24 records, maximum 48; text query 200 characters; detail recommendations 4; compare 4 IDs; owned product-context batch 100; message body 4,000 characters; at most 12 listing photos, 12 MiB each and 40 megapixels after byte validation; CSV 10 MiB/1,000 rows per import job. Limits are reviewed configuration and may tighten by category/plan. Never silently truncate essential terms or permit unlimited requests because the form has a client limit.

## Public queries

| Use case                | Validated input                                                                                                                            | Minimal output / acceptance                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `browseCategories`      | locale, country, seller kind, parent                                                                                                       | enabled category/leaf labels, eligibility-aware counts; no private inventory                   |
| `searchListings`        | query, leaf/root, seller all/personal/business, condition, typed attributes, locality/radius where supported, price/currency, sort, cursor | cards, canonical filters, next cursor, scoped facets; stable tie-break; removed items excluded |
| `readListingDetail`     | listing ID, locale, supported country                                                                                                      | listing/seller/gallery/variants/claims/fulfilment projection; no private owner/provider fields |
| `readSellerStorefront`  | seller handle/ID, scoped storefront filters/cursor                                                                                         | shared seller presentation and bounded eligible listing cards                                  |
| `readSellerInformation` | seller ID                                                                                                                                  | public declaration/policy/claim summary; private business documents excluded                   |
| `readSellerReviews`     | seller ID, bounded sort/filter/cursor                                                                                                      | eligible moderated reviews and real aggregate; no fabricated counts                            |
| `compareListings`       | at most 4 eligible IDs, caller filters                                                                                                     | comparable fields, units, condition, known totals and explicit missing facts                   |

Canonical URL inputs use `q`, `category`, `seller`, `condition`, `location`, `minPrice`, `maxPrice`, `currency`, `sort`, `cursor` and explicitly namespaced typed attributes. Share links/Back preserve them. A cursor is validated and bound to the exact query/scope/sort. Unsupported shipping/radius is surfaced, not interpreted as nationwide capability.

T05a implements this input boundary independently from the guarded reference search. Categories use stable registry IDs (for example `cat:electronics/phones`), not display slugs. Missing/invalid scope means `all`; default sort is `relevance`, with `newest`, `price_asc` and `price_desc` also allowed. `lang=bg|en` defaults to Bulgarian. URL prices are EUR major-unit decimals with at most two fractional digits; the normalized use-case input holds exact integer minor units. Unsupported currency drops the price range. Queries, locations, parameter counts and attributes are bounded. `attr.<fieldId>` accepts only fields owned by the selected leaf: scalar text/enums, integers, `true|false`, repeated multi-choice values and validated JSON unit/dimension objects. Required publication fields and cross-field declarations do not apply to a search criterion. Unknown/unsupported inputs are reported as adjusted fields and excluded from the canonical URL.

Scope switching preserves normalized filters and removes the cursor without touching operating seller context. The server-only cursor codec requires an explicitly supplied qualified signing key, binds the canonical query and category-registry version, validates the sort's exact bounded position shape and expires after 24 hours. A cursor carries no listing eligibility or seller authority; the future PostgreSQL query must independently enforce both public eligibility and its stable tie-break. T05b owns visible route/header integration and T07a owns the database query/key binding; this contract alone does not enable public inventory.

## Identity, sellers and catalogue commands

Private queries `readSellerContext`, `readSellerReadiness`, `readSellerOverview` and `listSellerListings` authenticate the human, validate current ownership/membership and return minimal projections. Listing filters have bounded URL-owned query/status/sort/cursor; cursors bind seller and normalized filters. Readiness returns stable operation-specific reason codes from [seller workspace](seller-workspace.md), not private evidence/provider objects.

`resolveSellEntry` is a read-only query that returns a permitted internal destination and required next mutation. It does not create a seller or draft. `saveSellerSetup` validates expected revision and updates only the caller's permitted fields; `startSellerPaymentOnboarding` requires payment-setup capability and returns a temporary provider URL after the persisted account intent is established. Its return/refresh handlers reauthorize and query provider status; returning is not completion.

| Use case                                                | Actor/resource rule                     | Effect / failure proof                                                               |
| ------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `completeSignupIntent`                                  | verified human                          | optional buyer/personal/business intent; no permission/plan grant from intent        |
| `ensurePersonalSeller`                                  | verified human                          | single idempotent personal seller and ownership                                      |
| `createBusinessSeller` / `updateSellerProfile`          | human / current permitted seller member | owned profile + initial membership; revision and trader declaration validation       |
| `inviteMember`, `acceptInvite`, `revokeMember`          | capability / intended verified invitee  | atomically reserve/consume seat; expiry/token identity; last-owner protection        |
| `createListingDraft`, `saveListingDraft`                | owned seller with listing capability    | durable draft/revision; stale update preserves both recoverable inputs               |
| `createUploadIntent`, `completeUpload`                  | same current draft owner                | private staged upload; ready state set after validation/process, not browser success |
| `publishListing`, `withdrawListing`, `markReportedSold` | current authorised seller               | atomic quota/policy/media checks; independent moderation/availability                |
| `updateStock`, `updateVariant`                          | inventory capability                    | validated SKU/revision; respects existing allocation; inventory-event receipt        |
| `previewImport`, `startImport`, `resumeImport`          | import capability and plan              | bounded owned file, row preview, durable idempotent drafts; no automatic publication |

## Buyer, communication and commerce commands

Current saved-item review is `readPublicationReview` at `/app/sellers/<sellerId>/listings/<draftId>/review`: read-only current seller access, saved field/media/policy/declaration/usage/restriction facts and minimal reason codes. It grants no publication eligibility. `withdrawListing` rechecks `listing.publish`, locks seller usage then listing, validates expected revision and records a scoped immutable retry receipt. Equivalent retries return their original revision only after current authority passes. `publishListing` now accepts seller/listing/request IDs, expected revision, the ordered photo ID/revision set and version-one ownership/accuracy/photo-rights and handover terms. It rechecks server facts, commits one immutable accepted snapshot and returns listing ID/revision/publication time. Reusing its retry key after withdrawal or replacement conflicts. Published edits require withdrawal, revisioned draft/media changes and explicit republication. `readPublishedListing` and `/api/listing-media/[listingId]/[assetId]?v=<accepted revision>` project only current eligible snapshots. Contact/report links reach the T38 authenticated routes; this does not implement checkout or public search. No client-ready flag bypasses publication requirements.

Current participant/report use cases are `openListingConversation`, `sendConversationMessage`, `readConversationMessages`, `readParticipantAttachment`, `createResourceReport` and `readOwnedReport`. Replies use current participant/capability authority and ordered durable acknowledgement; attachment views omit object keys. Operator queries and `moderateListing` use separate finite read/write grants. Decisions require expected moderation revision and a bounded reason, atomically reviewing the linked listing report. `appealModeration` permits only the affected current seller or reporter; its accepted record is immutable. Complete client inbox/report/appeal flows remain with their consuming tasks.

| Use case                                                    | Actor/resource rule                                       | Effect / failure proof                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `saveListing`, `followSeller`, `manageCollection`           | authenticated human owns target collection                | unique durable save/follow, reversible UI pending state                           |
| `saveSearch`, `setNotificationConsent`                      | human owns configuration                                  | versioned filters and revocable consent                                           |
| `openThread`, `sendMessage`, `markRead`, `blockUser`        | current participant or authorised seller inbox member     | persistence and sequence/dedupe; no foreign attachments/history                   |
| `makeOffer`, `counterOffer`, `acceptOffer`, `withdrawOffer` | correct current party and eligible listing                | revision/expiry validation; acceptance invokes common allocation                  |
| `createQuote`, `startCheckout`, `resumePayment`             | verified buyer, eligible listing/SKU and seller           | immutable totals/terms; one seller/currency; shared allocation and stable attempt |
| `advanceFulfilment`, `cancelOrder`, `openCase`              | authorised buyer/seller/operator for permitted transition | immutable commercial history; verified provider effects handled separately        |
| `requestRefund`, `reconcilePayment`, `releaseSettlement`    | reviewed capability and state                             | bounded refund/settlement, append-only ledger, unknown outcome recovery           |
| `writePurchaseReview`                                       | eligible participant/completed order                      | one eligible review; seller-reported sale denied                                  |

## Commercial and operator commands

`startSubscriptionCheckout`, `openBillingPortal`, `changePlan`, `purchasePromotion`, `cancelPromotion` require current seller billing/marketing capability and a server-owned versioned catalogue selection. Browser price, Stripe success redirect or a previous member's session never unlocks access. [Billing](../billing.md) and [promotions](promotions.md) define amounts and lifecycle.

`releaseSettlement` applies only to a provider configuration with an actual controlled release step. The destination-charge baseline observes/reconciles its automatic transfer; this command must not issue a second transfer or promise a delivery hold. Refunds/reversals use the corresponding frozen funds-flow policy.

`reportResource`, `submitAppeal`, `exportPersonalData`, `requestAccountClosure` are human-scoped; no paid entitlement is required for legal account rights. `reviewReport`, `moderateResource`, `reviewDeclaration` require explicit operator capability, restricted audit and a reason. Operators cannot invent a successful refund by setting a flag in the UI.

## HTTP and provider surfaces

| Proposed boundary                              | Contract                                                                                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/assistants/runs`                         | authenticated bounded streaming POST, one run/request key, validated assistant ID and typed constraints; cancellation/cost reconciliation |
| `/api/uploads/intents` and completion callback | current owner; signed narrow upload; no public arbitrary-object API                                                                       |
| `/api/webhooks/stripe`                         | signature over raw body, current account/environment, durable event dedupe and purpose correlation; no login cookie substitute            |
| identity/carrier webhook handlers as required  | verified provider-specific origin/signature, durable receipts and legal transitions                                                       |
| private job runner entry                       | authorised service identity, bounded leases; outbox handles replay and reconciliation                                                     |
| health/readiness                               | minimal operational result, no credentials/account dumps; distinction between process health and enabled-feature readiness                |

Paths are proposed owners for implementation, not required duplicate REST APIs around every Server Action. Existing reference endpoints remain non-production-only. Native/external API versioning starts only with a real consumer and reuses these use cases.

GET and render/prefetch routes have no seller/draft/upload/payment creation side effects. All such changes use Server Actions or authenticated POST handlers with bounded input, current authorization and request keys. Mutating cookie-authenticated HTTP routes enforce the chosen same-origin/CSRF policy; webhooks and Inngest callbacks use their verified provider signature rather than browser cookies. Proposed `/api/inngest` is the sole executor entry and `/api/internal/outbox` is an authenticated repair trigger, not an open command endpoint.

Bulk listing operations accept a bounded explicit ID/revision set and action enum, return per-item results, and invoke the same individual commands. Never accept a browser SQL filter as permission to affect every listing. Replay responses recheck access before exposing a stored result. Long jobs return an owned operation ID/status, not a fabricated completed result; polling rechecks the viewer's current authority.

## Assistant tool contracts

`searchListings`, `getListingFacts`, `compareListings`, `getCategoryAttributes`, `estimateKnownTotal` and `getCompatibilityFacts` are bounded public reads and preserve user constraints. `suggestListingDraft` reads only the current seller's authorised input/media. `proposeSavedSearch` and `proposeMessage` return a reviewable proposal; the ordinary human-authored command executes only after confirmation in the product. No arbitrary SQL, URLs, filesystem, browser automation, raw provider credentials or payment/admin tools are exposed to a shopping model.

## Contract verification

The private draft-photo Server Actions verify the current Clerk subject before the use case. Listing photo reads and reorder/removal use current database authority; intent creation and completion additionally require valid job/storage bindings. The browser supplies only bounded file claims and an actor/seller-scoped retry ID; it cannot set processing/ready state, object keys, job authority or derivative URLs. `/api/seller-media/[assetId]?sellerId=…` serves only owned ready draft derivatives with current read authorization and `private, no-store`; denied images return an opaque 404, provider unavailability 503. This is not a public listing gallery.

`/api/inngest` GET/POST/PUT is served by pinned Inngest `4.21.0` with cloud signature checking enabled and fixed configured origin/path. Missing bindings fail closed. Event data allow only job/seller IDs, generation/schema version and exact app/environment. `/api/internal/outbox` accepts only bearer-authenticated bounded POST repair requests; redrive requires a distinct secret, job ID, expected generation and reason. GET cannot enqueue/repair work. Error responses, executor step results and repair receipts contain codes/IDs/counts rather than private payloads or credentials.

Add schema/model tests before switching a route, isolated database tests for authority/races, provider sandbox/replay tests for effects, and browser tests for the visible journey. Test foreign IDs, revoked membership, tampered prices/scope, duplicate key with different input, cursor mismatch, cancelled stream, exhausted quota and explicit unavailability. [Testing](testing.md) lists evidence; no endpoint is marked implemented from this table alone.

## Implemented inbox and reporting transport

Web Server Actions in `features/messaging/actions.ts` implement `readInboxAction`, `readConversationAction`, `sendMessageAction`, `markReadAction`, `blockContactAction` and `startConversationAction`. Each verifies the current Clerk identity and then delegates to the transactional participant query/command. `sellerId: null` means the buyer inbox; a UUID requests that seller's current authority. Public seller-type filters are not accepted in these commands.

Inbox query bounds are 120 characters, 30 rows and a scope-bound cursor. Conversation history is 50 messages per page. Send accepts a plain-text body of at most 4,000 characters with a stable request UUID and up to four ready, uploader-owned image references. T72 adds participant-authorized private image intake and delivery; the text-only implementation is retained for messages without attachments. Read progress requires a delivered sequence, never a browser timestamp. Block/unblock requires thread ID, current contact revision, the intended boolean and a request UUID; it changes only the caller's side of the buyer/seller pair.

`/messages/new?listing=<uuid>` is a read-only confirmation page; its explicit action creates/reuses the authorized listing conversation. `/messages/report?kind=listing|message&id=<uuid>` opens a currently accessible resource report. Existing report/appeal Server Actions back `/messages/reports`, owned receipt pages and seller listing `/moderation` history. These private routes are no-index, use bounded return-path validation, and never expose a shared thread through a guessed ID. T72 implements private participant image delivery in the existing buyer and business inboxes. Actual provider-backed delivery and signed-in launch qualification remain separate from its explicit isolated tests.

## Implemented inventory, cart and offer boundaries

Inventory Server Actions accept only an owned seller/listing scope, an observed aggregate revision, a request UUID and one finite setup/variant/stock/archive operation. The session supplies the human; membership supplies business inventory authority. Published variant definitions cannot be edited in place. Current quantities can be corrected with a bounded reason, but cannot go below active reservations. Public availability reads accept only the listing and expected publication revision and return accepted options/prices plus current quantities, never seller SKU codes or private draft fields.

Account cart commands use the existing actor fingerprint and a cart revision. Add/set accepts only listing/SKU/publication IDs and quantity; prices and seller ownership are read on the server. Remove also works for an unavailable saved row. A changed publication must be explicitly reconfirmed. Public browse scope does not hide, erase or transfer cart lines. Cart reads and writes create no allocation or payment attempt.

Offer reads are current-participant-only, with a bounded 20-entry sequence page. Commands contain the inbox scope, thread ID, observed offer revision, request UUID and a finite proposal/counter/accept/reject/withdraw/cancel operation. Proposal prices are positive integer EUR minor units, quantity is at most 99, and expiry is one of the supported server-policy durations. Counters retain the item, publication, SKU and quantity of the pending offer. Both accepted terms and the linked allocation remain immutable. A message event and notification intent commit with the command; external notification delivery is still a separate consumer.

The allocation and accepted-offer quote-handoff functions are internal transaction APIs, not public browser endpoints. Future payment quotes must reuse a live accepted-offer allocation rather than creating a second hold. No browser redirect or request-supplied payment reference can invoke settlement. An expired or invalidated allocation with a later verified provider success enters reconciliation, not another stock deduction.


## Business CSV and seller-wide stock — T42 continuation

Private `/app/sellers/[sellerId]/inventory` reads a 30-row seller-authorized stock index with literal product/SKU search, available/reserved/out-of-stock/unconfigured filters and actor/seller/filter-bound cursor pages. Quantities come from the same current stock and active allocations as product detail and offer acceptance. An adjustment opens the existing revisioned inventory command; it cannot lower on-hand below active reservations. Unconfigured listings remain unknown rather than receiving an invented quantity.

Private `/app/sellers/[sellerId]/imports` and its `/[importId]` detail expose authenticated CSV upload, row review/correction, explicit selection, start/resume, cancellation, draft links and a formula-safe owned report. The server action boundary accepts a maximum 10 MiB CSV through separately authenticated 128 KiB chunks rather than raising the global action body limit. Up to 1,000 rows may be reviewed; the actual plan controls the selected/created count. File-level parse errors and per-row category/price/stock errors are separate. Templates have no fabricated products; the category guide is generated from the actual shared registry.

Only `import.run` business members may read imports. Mutations also require `listing.write`; inventory initialization uses the normal current inventory capability. Clients supply resource IDs, expected revisions and retry IDs, never a trusted actor, plan or publication grant. GET/read actions create no data. Creation, chunk acknowledgement, row edits, job handoff and created-draft results are durable. The existing Clerk identity is verified on every action. Browser memory retains only in-flight input/projections and cannot substitute for Neon persistence.

The `catalogue.import` job uses the existing signed Inngest executor and member-authorized outbox, not a second queue. A successful enqueue is reported as waiting, not as completed processing. A stopped worker is surfaced with a resumable state; each remaining row is validated again. The structured-offer and cart allocation sources remain preparation for a qualified checkout provider, not a working payment gateway.

### Bulk stock and current-page export

`changeStockBatchAction` receives seller ID, request UUID, reason/kind and 1–30 explicit listing/SKU/expected-inventory-revision/new-on-hand rows. Current Clerk and seller inventory authority are derived server-side. Duplicate SKU IDs, inconsistent revisions for the same product, implicit selections, foreign IDs, stale revisions and reductions below reserved stock are rejected. The transaction reuses the ordinary stock command and is all-or-nothing. Its durable receipt retains final product revisions, so lost acknowledgements can be retried without changing quantities twice.

`exportInventoryPageAction` accepts the same authorized seller/filter/cursor input as the inventory index and exports at most that page's 30 rows. Browser-supplied titles, prices and stock are not exported as authoritative facts. Unconfigured quantities remain empty. Every spreadsheet cell is quoted and formula-safe.

`expireOffers` is an internal signed-job consumer, not a browser mutation. It records system timer outcomes once, releases expired accepted holds through the shared allocation boundary, and preserves the accepted terms. The participant projection adds bounded per-offer timer history; it does not serialize another participant's identity or create a fictional system account.


## Private message image transport — T72

The existing conversation reply command accepts at most four ready image IDs from the current human and operating conversation scope. Staging, status and unbound removal are authenticated Server Actions, bound to the expected signed-in subject. Same-origin PUT on `/api/message-attachments/[id]` additionally verifies Origin, subject, content type and both declared and actual byte counts before processing. GET rechecks current participant authority before and after storage I/O, denies moderated messages, and returns checked WebP bytes with private/no-store headers rather than a public storage key.

Intake permits still JPEG, PNG and WebP up to 3 MiB and 20 megapixels; server re-encoding strips source metadata and bounds the output edge to 2,048 pixels. Unique source/derivative keys are registered before writes, and completed message links bind immutable processed images. Unbound uploads expire after 24 hours and are swept through registered-object cleanup. Sent images use the separate reviewed lifecycle extension below. Generic documents, SVG and executable attachments are not supported.

### Message-image closure and personal export

Additive `0048_message_image_lifecycle` requires a separately approved immutable `message-image-lifecycle-v1` rule bound to the original closure policy, lifecycle binding and private message storage namespace. It explicitly chooses retention or removal with a reviewed delay; no default communication retention period is supplied. Existing policies and plans do not acquire this authority automatically. Owned registrations, original links, state, revision and write/retention leases are frozen at review and compared during database acceptance. Changed resources require another review.

Only own personal buyer/personal-seller images covered by an explicit removal rule may be tombstoned, through the original accepted artifact and live service/effect lease. Business-authored images, counterpart images, report/case evidence, accepted commerce relationships and current lawful holds survive. The first authorized effect commits an access tombstone; participant reads then show an unavailable image while message history and links remain intact. Cancellation before effects preserves image access. Current policy/binding/holds/object registration/lease are checked before storage IO and acknowledgment; uncertain deletion remains unconfirmed and retryable. This source does not approve legal rules or qualify a real provider.

The existing free personal JSON snapshot remains `treido-personal-data-v1`. Its App account section adds versioned `ownCommunicationMetadataV1` and `ownMessageImageMetadataV1` records: own personal message/image IDs, thread ID, authored time, sequence/image count or image state/dimensions. These share the existing 50-record/32-KiB category limit and 256-KiB file limit. Text, business communication, counterpart content, image bytes, raw filenames, storage/object keys, delivery URLs and provider identifiers are excluded. Previous persisted v1 downloads remain readable through the same current-human/recent-auth route. A bounded snapshot is not a full historical rights response.

Additive `0050_message_image_dispatch_barrier` serializes irreversible image dispatch against matching retention evidence. A hold committed first denies dispatch. Once dispatch commits, a later matching hold/report/commerce-evidence write returns an explicit retention conflict while the exact object is unresolved; it cannot claim that bytes were preserved. The barrier survives lease expiry and mixed-version workers. Provider observations persist separately from effect acknowledgement, and fresh recovery observes known absence without issuing another DELETE. No database transaction remains open across storage I/O.

## Invitation delivery and billing recovery — T72

Team invitation delivery uses the existing durable job identity and an explicitly configured Resend sender/domain/application/environment. Provider acknowledgement is submitted, not delivered; known-ID reconciliation updates delivery state without sending another email. Unknown acknowledgements can only retry the original frozen payload/key within the supported deduplication bound. Reconciliation filters the exact immutable binding before its five-row page limit, so another binding cannot stall this application's status updates.

New seller plan changes use reviewed pending updates with a frozen invoice. Deliberate abandonment requires current billing authority and recent authentication and can void only that invoice. Replacement remains blocked until authoritative reconciliation proves terminal safe state. Existing ambiguous portal flows expose their retained recovery/escalation reference, not a fabricated local cancellation. Actual provider bindings and sandbox confirmation are not established by these interfaces.
