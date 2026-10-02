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

Inbox query bounds are 120 characters, 30 rows and a scope-bound cursor. Conversation history is 50 messages per page. Send accepts a plain-text body of at most 4,000 characters with a stable request UUID; the current UI does not upload attachments. Read progress requires a delivered sequence, never a browser timestamp. Block/unblock requires thread ID, current contact revision, the intended boolean and a request UUID; it changes only the caller's side of the buyer/seller pair.

`/messages/new?listing=<uuid>` is a read-only confirmation page; its explicit action creates/reuses the authorized listing conversation. `/messages/report?kind=listing|message&id=<uuid>` opens a currently accessible resource report. Existing report/appeal Server Actions back `/messages/reports`, owned receipt pages and seller listing `/moderation` history. These private routes are no-index, use bounded return-path validation, and never expose a shared thread through a guessed ID. External notification delivery, participant attachment delivery and the real public-detail consumer remain separate implementation work.
