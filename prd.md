# Product requirements — Treido

Bulgaria-first general physical goods, personal and business sellers, responsive web first. Updated September 30, 2026 for the owner's full first web release target, October 1 morning in Europe/Sofia. [Features](docs/features.md) maps the end goal and [tasks.md](tasks.md) records implementation. All prior `GLOBAL-*` IDs are retained. A first implementation slice is not the full release; [launch](docs/launch.md) requires all requested web features and their evidence.

## Current acceptance context — October 2, 2026

The requested October 1 delivery date is historical, not evidence that a release happened. Current completion and blockers live only in [tasks](tasks.md). Keep all existing feature/requirement IDs and their full acceptance; do not redefine a preview or first working slice as the entire release. Rendered acceptance follows the separate Shop buyer and Shopify-derived Studio patterns in [UI patterns](docs/ui-patterns.md) and [UI verification](docs/ui-verification.md), including approved Treido differences, BG/EN and personal/business isolation.

## Final foundation and task acceptance

The selected app remains `treido-eu-global/app`; Foods is separate. D23–D25 in [decisions](docs/decisions.md) close the foundation choice. Shop-derived presentation must support both stocked businesses and an individual selling a single used item.

Public cards and details expose the facts needed for comparison: title, exact amount/currency, condition, location, seller kind and supported handover/contact. Keyword/category search works without an assistant and has useful idle, empty and error states. The seller can create/recover a draft and publish through authorized rules without configuring an elaborate storefront. Store vitrini, follow/save and shopping tools enrich that core flow. Existing requirement IDs below own the corresponding implementation and evidence.

## Delivery boundaries

The first dependency chain is personal/business identity → taxonomy/draft/photos → publish → discover/detail → save/message/report. The full web release also includes staff/storefronts, stock/variants/imports, offers, checkout/fulfilment/refunds, plans, boosts, assistants and operator/account tools. Implement each as a bounded verified increment. Existing clone controls do not make those features implemented; documented prices/provider choices remain distinct from approved live mappings.

Launch only approved, supportable physical-goods categories. Start taxonomy/data contracts broadly enough for electronics, fashion, home, sport, books and collectibles; exact enabled categories follow a safety review. Food delivery, services, property, whole vehicles, digital goods and regulated categories are not implicitly enabled by “everything.” Do not turn this into the other food or vehicle product.

<a id="global-scope"></a>
## GLOBAL-SCOPE — Personal and business browsing

**Scope: Core.** Public browsing supports seller-kind filtering independently of the user's active operating seller. The requested header control uses the existing visual system. Seller type, condition, verification, commercial warranty and plan are independent fields. See [browse contract](docs/marketplace.md#browse-scope).

**Acceptance:** a guest selects Businesses; a used business listing remains eligible, a new personal listing does not. Switching retains query/category/condition/location/price/sort, resets pagination and respects Back/Forward. It never changes seller ownership, a draft, a cart or authorization. No false “new with warranty” claim appears.

<a id="global-cat"></a>
## GLOBAL-CAT — General-goods listings

**Scope: Core.** Stable listing identity owns seller, photos, category, condition/defects, typed attributes, price/currency, approximate location and supported handover. Publication, moderation and availability are independent. Unique resale is quantity one; business stock/variants follow GLOBAL-INVENTORY in the full first web target. Sold/removed items cannot remain orderable.

**Acceptance:** publish a used camera with defects; edit its current price without changing accepted order terms; remove it and deny direct-link purchase. Unknown condition/warranty information is not presented as a positive claim.

<a id="global-disc"></a>
## GLOBAL-DISC — Discovery, saves and following

**Scope: Core.** Canonical URL search/category/location/price/condition/seller-kind/sort; bounded public listing detail and seller pages; private collections, follows, recent views and opt-in saved-search alerts. Bookmarks are not orders. Search uses eligible real records and stable pagination.

**Acceptance:** return from detail with query/filter/scroll restored; saved sold items show sold rather than disappear; restricted content does not leak through search or saved previews; opt-out is rechecked before alert delivery. Zero results has an honest recovery path.

<a id="global-sell"></a>
## GLOBAL-SELL — Phone-first publishing

**Scope: Core.** Create a personal seller without mandatory business setup. Photo upload/reorder, recoverable autosave, fields, preview, publish/edit/withdraw and draft-conflict recovery. Choose business context explicitly; show the owning seller throughout editing.

**Acceptance:** interrupt an upload, reload and finish the saved draft; reject unowned/unready media; switching business does not transfer a personal listing; a foreign seller cannot read/edit the draft. Stale edits return a recoverable conflict, not silent loss.

<a id="global-work"></a>
## GLOBAL-WORK — Business memberships and operations

**Scope: Core.** A human may have one personal seller and memberships in multiple businesses. Store/team/listing/inbox/analytics scope follows the selected seller. Owners and members have explicit capabilities. Personal accounts cannot invite business teammates. Preserve the last active business owner.

**Acceptance:** revoked and wrong-seller members lose private reads, writes and billing access on their next request; original listings and prior orders survive context switches. Invites are recipient-bound, expire and consume configured seat capacity atomically.

<a id="global-msg"></a>
## GLOBAL-MSG — Messages and structured offers

**Scope: Core.** Durable listing-bound, participant-only conversations, pagination/unread/retry, permitted attachments, block/report and offers/counteroffers/expiry. Accepted offer/reservation is not payment. Expiry is explicit product configuration, not a copied donor value.

**Acceptance:** retry a send without duplication; deny an unrelated reader; preserve expired offer history; acceptance and checkout compete through one unique-item allocation. A blocked user cannot start abusive contact, while existing order/support obligations remain reachable through a scoped path.

<a id="global-order"></a>
## GLOBAL-ORDER — Unique and stocked item commerce

**Scope: Full first web target, after commerce qualification.** One seller and currency per order, with one or more lines. Unique listings have quantity one; stocked variants have server-controlled SKU quantities. A multi-seller cart visibly groups separate checkouts. Server quote includes applicable shipping/fees/tax policy. Atomic allocation, verified provider payment and immutable terms; cancellation, returns, partial/full refunds, disputes and settlement complete the target. This supersedes the quantity-one-only launch assumption; shared unique-item protection remains mandatory.

**Acceptance:** simultaneous buyers cannot both acquire the item. Unknown provider outcomes reconcile without a second charge. A late payment after allocation loss cannot take another buyer's item and enters compensation. Refunds do not silently relist a sold item. Browser success URLs never prove payment.

<a id="global-plan"></a>
## GLOBAL-PLAN — Seller plans and exact quotas

**Scope: Core.** Retain `personal_free`, `personal_pro`, `business_free`, `business_pro`. Versioned listing/draft/seat/history/export rules in [billing](billing.md) are development defaults, not live offers. Last-slot publishing and invitations enforce quotas atomically.

**Acceptance:** concurrent publishes with one remaining slot admit one. Downgrade preserves existing listings/members and order/support access while restricting new over-limit activity. Membership, subscription and identity verification cannot substitute for one another.

<a id="global-ai"></a>
## GLOBAL-AI — Editable buyer AI discovery

**Scope: Core, after deterministic search.** Natural-language needs become visible typed constraints against real public records. Support Bulgarian, transliteration and model names with a deterministic fallback. Refinement preserves earlier hard constraints. Buyer budget/rate limits do not multiply through seller switching.

**Acceptance:** Sony under a stated budget returns no fabricated listing; unsupported constraints are explained rather than silently removed. The user can edit/remove filters. Provider failure returns a usable normal search, not invented availability. Product text is untrusted input, not instructions to the agent.

<a id="global-trust"></a>
## GLOBAL-TRUST — Trust, accounts and platform support

**Scope: Core; minimal reporting/moderation ships with publication.** Reporting, blocking, reasoned moderation, appeals, eligible purchase reviews, account preferences/security/export/closure and access-limited support. Paid status buys neither verification nor immunity. Off-platform reported sales are not verified purchases.

**Acceptance:** removed listings stay removed after ordinary edits and cache refresh; a manually marked sale cannot create a verified review. Export scopes to the requester and excludes other sellers' private data. A report persists with a receipt and an operator can act on it. Account closure preserves legally required order/business records under a reviewed retention policy.

<a id="global-insight"></a>
## GLOBAL-INSIGHT — Useful seller and operational metrics

**Scope: Core.** Real views, inquiries, offers, orders, reported versus verified sales and subscription revenue remain distinct. Scope commercial history/export to the seller plan; minimize tracking and show honest empty states. Safety outcomes accompany conversion metrics.

**Acceptance:** a new business has no fabricated graph. Merchandise value excludes subscriptions, boosts and unverified seller-reported sales. Seller analytics export and a person's legal data export have separate access rules. Events record provenance and deduplication where correctness requires it.

<a id="global-expand"></a>
## GLOBAL-EXPAND — Retained expansion

**Scope: International/advanced expansion.** Native, extra tiers/annual/trials, cross-border commerce, auctions, unified multi-seller payment and enterprise integrations have named contracts in [features](docs/features.md#global-expansion-contracts). Stock/variants, imports, seller drafting assistance and promotions now belong to the full first web target under the new IDs below. No feature is automatically implemented merely because the clone contains a similar control.

**Acceptance:** an expansion task names new entities, permissions, policies, data migration and verification before exposure. Unsupported services never return fake success. Country rollout checks logistics, payment eligibility, rights, tax, localization and moderation readiness rather than just adding a language selector.

<a id="global-onboard"></a>
## GLOBAL-ONBOARD — Signup intent and seller entry

**Scope: Full first web target.** One human login; skippable Buy / Sell my items / Sell as a business intent; idempotent personal seller; separately created/joined business and recoverable interrupted actions. [Journeys J02–J04](docs/journeys.md) owns the exact flow.

**Acceptance:** buyer signup does not require business details or a paid plan. A human can keep personal listings and join two businesses. Tampered intent/selected seller grants no membership. Cancelled login resumes the original draft/action without losing input.

<a id="global-taxonomy"></a>
## GLOBAL-TAXONOMY — Full catalogue and policy-aware attributes

**Scope: Full first web target.** Implement the sixteen roots and leaves in [categories](docs/categories.md), BG/EN labels, immutable IDs, typed leaf attributes, applicable condition/fulfilment modes and versioned country/item policy. Retire donor taxonomy only in product mode.

**Acceptance:** navigation, publish/import validators, search facets and AI use the same registry. Disabled/unknown leaves, invalid attributes, cycles/orphans and incompatible units are rejected. Category renames preserve old links/order snapshots. Restricted items cannot bypass review through an Other leaf.

<a id="global-inventory"></a>
## GLOBAL-INVENTORY — Unique goods and business stock

**Scope: Full first web target.** Unique quantity-one items plus stocked SKUs/variants with current availability, seller adjustments and history. Shared allocation is used by offer acceptance and checkout. [Data model](docs/data-model.md) owns transactional integrity.

**Acceptance:** two buyers cannot both acquire one unique item or oversell a SKU's last unit. A multi-line checkout allocates all lines or none. Seller edits/restock cannot overwrite active reservations or accepted terms. A refund is not automatic restock.

<a id="global-import"></a>
## GLOBAL-IMPORT — Business catalogue onboarding

**Scope: Full first web target.** Bounded CSV mapping/preview, policy/attribute/media validation, resumable idempotent draft creation and scoped export. Review and publish use the normal authority/quota path.

**Acceptance:** retry does not duplicate imported drafts; invalid rows are repairable; another seller's media/records are denied; external images cannot fetch internal services; imports cannot bypass quotas or auto-publish unreviewed products.

<a id="global-promo"></a>
## GLOBAL-PROMO — Paid visibility with truthful delivery

**Scope: Full first web target.** Versioned bump/category/home products, exact prospective prices, confirmed payment, eligible serving capacity, finite interval, Sponsored label, honest metrics and reason-specific compensation. [Promotions](docs/promotions.md) owns ranking and lifecycle.

**Acceptance:** personal campaigns never enter business-only results; unavailable/moderated listings stop serving; hard search constraints remain intact; one payment grants one campaign; over-capacity sales are denied/queued; platform delivery failures have a real remedy.

<a id="global-minis"></a>
## GLOBAL-MINIS — Useful Treido shopping tools

**Scope: Full first web target.** The existing Mini catalogue/sheets/results become Find for me/voice, Deal Finder, Compare, Photo Match, Gift Finder, Compatibility and Sell Helper. [Assistants](docs/assistants.md) owns tools, model routing, budgets, privacy and evaluation.

**Acceptance:** results cite eligible real listings, respect Personal/Businesses and all hard filters, label unknown costs/compatibility and recover from provider failure. No invented listing/claim or unreviewed purchase/message/publication; concurrent and cancelled requests preserve durable human budgets. Captured answers do not qualify.

<a id="global-data"></a>
## GLOBAL-DATA — Durable server authority and recovery

**Scope: Full first web target.** [Data model](docs/data-model.md), [API](docs/api.md) and [backend](docs/backend.md) specify identity, seller/catalogue/media, communication, commerce, plans/promotion/AI and operator effects. Isolated migrations, real database constraints, parameterized bounded reads, durable jobs, replay/reconciliation and tested restore.

**Acceptance:** foreign IDs/revoked membership denied; stale/duplicate/concurrent commands cannot corrupt ownership, quotas, stock or money. Required service failure remains explicit. Restored state reconciles external effects and never reissues a charge blindly. No credentials/private data in public projections.

<a id="global-launch"></a>
## GLOBAL-LAUNCH — Complete web release and operating product

**Scope: Full first web target.** F01–F29 in [features](docs/features.md), qualified supply/providers/policies, production UX/SEO/media, operator support and actual measurement. [Launch](docs/launch.md) owns the October 1 morning target and qualification method.

**Acceptance:** each enabled journey has positive/denial/failure evidence and the relevant visual/database/provider checks. Published inventory is real/rights-cleared; production denies reference handlers; recruited users can complete actual journeys; operators resolve a report/case. No release claim based solely on a plan, preview or unit suite.

## Shared quality and release acceptance

Preserve [styling](styling.md). Cover input/error/empty/loading/pending states, recoverable drafts, phone and affected desktop layouts, Bulgarian/English and long copy, keyboard/focus, Back and scroll behavior. Public detail must be shareable and render meaningful content without requiring the entire client catalog.

Private access, price, quantity, permissions, quotas and paid access are server-controlled. Test cross-account, stale edit, retry and concurrency cases relevant to each change. Product data/claims remain separate from fixtures and assumptions. Release needs real isolated persistence and provider sandbox evidence for enabled integrations.

## Open decisions

[Decisions](docs/decisions.md) records the adopted full target, explicit browse control/signup/catalogue/inventory direction and concrete recommended commercial/provider choices. Category exposure/rights and actual live account/catalogue/legal policy are qualified by their tasks. Continue known contracts and isolated implementation without another whole-platform planning phase; never present proposed terms as an approved public offer.
