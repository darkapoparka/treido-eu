# Marketplace model and behavior

Target model, not an applied schema. Implement only the entities required by the next slice. [PRD](../prd.md) owns outcomes; this file owns invariants shared by the frontend and backend. [Journeys](journeys.md), [categories](categories.md), [data model](data-model.md) and [API](api.md) specify the complete target. Drizzle schema plus reviewed SQL migrations become physical schema authority when introduced.

## Identity is not a selling mode

| Concept | Meaning / authority |
|---|---|
| `User` | Authenticated human mapped from the identity provider; private identity separated from public profile |
| `SellerAccount` | Stable personal/business owner of listings, subscriptions and obligations |
| `Membership` | Current human-to-business role/status/capabilities; unique pair; revoked access enforced server-side |
| `SellerDeclaration` | Versioned trader/disclosure information and review state, separate from branding or a paid plan |
| `Verification` | Specific evidence-backed claim, issuer, scope and expiry; no generic paid verification |
| `BrowseScope` | Public filter for seller kind; no authorization power |

Enforce at most one personal seller per human and one membership per human/business. Personal seller membership is not an invitation system. Business owners can invite permitted members and cannot revoke the last active owner. Listing `sellerId` is immutable during ordinary edits. Changing an ownership model requires an explicit migration, not a UI toggle.

Initial capability roles: owner manages all seller operations; manager manages listings/inbox but not ownership or billing unless explicitly granted; member receives only named operations. Implement capabilities, not scattered `role === 'admin'` checks. Platform moderation is a separate protected operator capability.

Signup intent is optional and editable: Buy, Sell personal items or Set up a business. It never assigns a permanent personal/business human type. A personal seller is created idempotently on entry to selling; a business requires its own profile/declaration and owner membership. Existing humans can add businesses or accept invitations without creating another login. A commercial seller must use the applicable trader disclosure, regardless of its chosen branding or plan.

<a id="browse-scope"></a>
## Browse scope — the requested header control

Canonical contract: `seller=all|personal|business`. Missing/invalid values normalize to `all`; `all` preserves the current mixed-feed default. D04 adopts one pill showing the current selection (All sellers, Personal or Businesses). Tap opens the existing-style sheet with those three explicit choices and a checkmark beside the current one. Home places it beside profile/notifications and retains Deals/Following/Saved/Minis in the same horizontal shortcut row; Search reuses its filter strip. No duplicated scope row, underlined reset, binary mode cycle or added dock destination. The selected control must truthfully describe the results.

Scope is URL-owned for shared discovery routes. A guest can use it. Explicit URL state wins over an optional non-sensitive preference; do not personalize a shared URL differently on the server and client. A selected button is truthful about the current result set, with an accessible group label and selected state.

Switching keeps query, category, condition, price, location, locale and sort; resets cursor and result-scroll position; preserves detail-return navigation through route state. Old filter results must not overwrite a newer selection during a slow response. Browser Back restores the previous scope and query. Saved-search alerts store the scope with the query.

Home and root Explore dock taps keep only public seller scope/language and retire query/category/filters. Root Explore browses the complete taxonomy regardless of seller kind, without seller/filter chrome. Department tiles and See all share one filterable category destination at `/explore/<category>`, using the existing Search presenter and query adapter. Category-scoped keyword/filter/pagination changes retain that route; unscoped criteria use `/search`. Old Search/query-category links redirect with validated criteria and bounded pagination. The path owns the category and repairs conflicting/absent query category before reading supply. Home and results own All/Personal/Business filtering; their sheet follows the same department/group/leaf tree. The result-page dock magnifier enters its contextual editor immediately. Category Back restores the actual source; direct groups/leaves fall back to the recorded parent with compatible criteria, and direct departments to clean Explore with scope/language. Root Explore has no Back. Direct filtered Home links retain their context and clear actions. Query/filter changes retain explicit BG/EN; empty results and unavailable reads remain distinct.

Root Explore previews use language and mixed supply independently of carried seller/price/query criteria. Category results apply those criteria with visible controls, facets and pagination; category routes no longer render a second unfilterable preview page.

Operating seller context is separately represented by the authorized `sellerId` in selling/business routes or a server-validated preference. Browsing mode never transfers a draft, clears a cart, changes an invoice, creates a business, grants a role or changes the login. Saved items and existing orders may contain both seller kinds; they are not silently hidden or deleted when discovery scope changes. Direct listing links remain valid across browse scopes if the listing is publicly eligible.

Condition is independent: `new`, `new_other`, `like_new`, `good`, `fair`, `for_parts`, `refurbished`; each leaf allows only applicable values and required evidence from [categories](categories.md). Refurbishment records seller/process details without implying a universal guarantee. Do not infer warranty, authenticity, verified status or tax treatment from `business`. Applicable trader disclosures and consumer rights require reviewed country policy; [sources](../sources.md#marketplace-research) records primary guidance.

## Minimal data by delivery slice

| Slice | Entities introduced when needed |
|---|---|
| Identity + publish | User, SellerAccount, Membership, SellerDeclaration, Category, AttributeDefinition, Listing, MediaAsset, ListingMedia |
| Discovery + interaction | SavedListing, Collection, CollectionItem, Follow, Conversation, Message, Report, ModerationAction |
| Offers + purchase | Offer, Allocation, Quote, CheckoutAttempt, Order, OrderLine, PaymentEvent, Refund, Shipment, ReturnCase, SettlementEntry |
| Plans + operation | PlanVersion, Subscription, Entitlement, UsageCounter, Invitation, provider event/attempt records |
| Delivery + later search | OutboxEvent, Notification, DeliveryAttempt, SavedSearch; derived search/analytics documents only when required |
| Business catalogue | ListingSKU, StockEvent, AllocationLine, ImportJob, ImportRow; stock/variant and row revision constraints |
| Boosts + assistants | PromotionProductVersion, PromotionPurchase, Placement, AssistantRun, AssistantBudget, trace/effect records |

Use stable UUIDs, server timestamps, immutable ownership and explicit revisions. Slugs are aliases with redirect history. Money is safe integer minor units plus ISO currency with validated bounds; no floating-point arithmetic for charges. Public approximate location is separate from private delivery addresses. Unknown, false and not-applicable must remain distinguishable.

Category definitions own typed attributes, required fields and allowed values. Avoid one free-form JSON blob with no validation, but allow a versioned typed attribute payload rather than an enormous table per category. Choose indexes from actual queries. Start with finite supported category schemas; do not implement a taxonomy management platform first.

The category registry has 16 roots, BG/EN leaf labels, immutable IDs and explicit publication-policy versions. Roots are browse containers; listings publish to reviewed leaves. CSV import uses these same definitions and normal draft/publish rules. An import is never authority to publish unreviewed rows, exceed quotas, copy external photos or convert disabled goods into an Other leaf.

An interrupted import command keeps its original request ID, revision and row terms in memory for that human, seller and import. Later permission denial or revision conflict does not prove the earlier command failed. A fresh authorized read enables deliberate retry of the original change, including after ordinary new changes become unavailable; explicit Use current import adopts the current revision without claiming the earlier change was acknowledged. Same-import pagination retains this recovery and the local row draft, while session, resource, page and visibility changes require fresh qualification. Unqualified rows and dialogs are absent, and obsolete responses, report downloads and cleanup cannot affect a newer operation. Nothing automatically resends a write.

## Listing lifecycle

| Dimension | States | Invariant |
|---|---|---|
| Publication | draft → published → withdrawn | Publish validates seller, fields, media, eligibility and quota; withdrawal is reversible only by policy |
| Moderation | unreviewed / approved / restricted / removed | Only authorized moderation changes it; ordinary seller edits do not clear restrictions |
| Availability | available / reserved / sold | Controlled by allocation/use cases; sold provenance distinguishes reported from verified sale |
| Media | staged / processing / ready / failed / detached | Only ready, owned, permitted assets can attach to a published listing |

Public visibility and purchase eligibility are separate functions. A safely redacted sold page can remain useful; removed sensitive content cannot remain in metadata, search cards or asset delivery. Sold/removed items cannot be ordered. A seller's “sold elsewhere” action records reported provenance, does not invent an order and must reconcile any active allocation before changing availability.

Draft edits use expected revisions. Autosave returns the authoritative revision; older in-flight responses cannot replace newer state. A failed upload or edit retains recoverable user input. Publishing and quota consumption share one transaction. Repeated identical publish requests do not consume extra capacity.

## Search and discovery

Normalize bounded inputs on the server: query length, allowed category/condition/seller-kind values, geographic scope, money range, sort and cursor. Never accept SQL/order fragments or trust client-filtered eligibility. PostgreSQL full-text/trigram plus explicit normalization is the starting strategy; evaluate Bulgarian, transliteration and exact model names with a small labeled query set.

Read only required columns, cap page size and use a stable sort with a tie-breaker. Validate cursor shape and bind it to the normalized query/scope; changing filters invalidates it. Counts and facets must use the same eligibility/seller filter as results. Avoid an unbounded `Catalog` prop or fetching all listings then filtering client-side.

Cached/indexed records are derived. A stale search result cannot grant purchase rights; removed content needs prompt read-path exclusion as well as index/cache invalidation. Rank organic relevance independently of paid slots. The full first web target includes labelled placement from [promotions](promotions.md), which cannot bypass safety or hard filters. Sponsored supply respects seller kind, leaf, condition, geography, price and current availability.

## Conversations and offers

Conversation identity binds buyer, seller and listing; prevent self-contact where appropriate. Messages persist before delivery signals. Use server sequence/cursor ordering, participant authorization, a sender-scoped retry key, bounded attachments and monotonic read progress. Membership revocation applies to business inbox reads, not just writes. Prefer simple bounded polling first unless actual realtime needs justify a provider.

Offers: `pending → accepted | rejected | withdrawn | expired | superseded`. Countering creates a new immutable offer and supersedes the previous pending one atomically. Validate current participant, listing revision, currency, amount and expiry. Acceptance records agreed terms and obtains the same allocation used by checkout; it does not mark paid. An accepted offer remains historical even if its allocation later expires.

## Unique-item allocation

Allocation: `active → consumed | released | expired`, with one live claim per listing. Use database time, a transaction/row lock and a constraint or equivalent single-allocation design. Every hold, offer acceptance, checkout and expiry path follows the same locking order.

An expired timestamp alone does not remove a row from a partial unique index. Commands must safely reconcile an expired active allocation before acquiring another; jobs are supplementary. A paid callback for a lost/expired allocation enters reconciliation/compensation instead of stealing another buyer's item. Never relist automatically just because a refund happened.

## Stocked products and orders

Business listings can use `stocked` inventory with validated SKU option combinations and quantity, or `unique` quantity-one goods. Personal resale uses unique goods. A stocked listing counts once toward active-listing quota; variants have separate bounded limits. Sellers cannot reduce stock below current committed/allocated quantity or edit accepted order terms. Stock events record reason/actor/revision; refunds do not silently increase saleable stock without an inspected return decision.

Allocation lines bind listing/SKU, quantity and quote/offer. Lock all affected inventory in stable ID order, verify current availability, and reserve every line atomically or none. No offer path, import or checkout has its own weaker stock counter. Reconcile expiry and uncertain provider outcomes before allowing a conflicting claim. [Data model](data-model.md) specifies constraints and race cases.

The cart groups seller/currency obligations; each checkout produces one seller/currency order with one or more immutable line snapshots. Show all known item/delivery/fee/tax amounts before payment, or explicitly require missing delivery information. Pickup/contact-only arrangements state that payment is outside Treido and never produce platform-paid reviews or GMV. Fulfilment, return/case, payment and settlement are independent lifecycles from [billing](../billing.md) and [journeys](journeys.md).

## Honest insight

Record consent/retention-reviewed public view events, saves, conversation leads, offer outcomes, confirmed orders and item revenue with stable deduplication. Business reports scope to the current seller and member capability; legal personal exports are free. Impressions/clicks, paid orders and seller-reported sales remain separate. GMV counts actual item-order value according to the frozen reporting definition; plans and boosts are platform revenue, not GMV. No captured reference ratings, conversion or sales populate production dashboards.

## Trust and privacy

Keep reports, evidence and operator notes private. Moderation records actor, policy reason, prior/new state and appeal trail. A user-facing report button must create a durable record and receipt, not just hide a card locally. Scope blocking to contact rules while retaining a controlled path for existing order/support obligations.

Verified reviews require an eligible completed transaction and a unique reviewer/order rule. Private purchases, claims and warranty evidence do not become public by default. Collection visibility starts private; public sharing is a later deliberate feature. Legal personal-data export is not a paid-plan entitlement. Retention/deletion needs reviewed policy before launch.
