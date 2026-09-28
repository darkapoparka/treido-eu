# PRD — Treido Global / general marketplace

A Bulgaria-first general physical-goods marketplace for personal sellers and businesses, designed for later country-by-country expansion.

## Reading this contract

Target product behavior; implementation status lives in [tasks.md](tasks.md). Scope labels distinguish current work, later work and proposals. [sources.md](sources.md) retains historical evidence only when a specific question needs it.

<a id="global-cat"></a>
### GLOBAL-CAT — General-goods listings

**Scope:** Core.

Unique listing identity owns seller, photos, category, condition/defects, attributes, price/currency, approximate location and supported handover. Draft, publication, moderation and availability are independent. Sold/removed items cannot remain orderable.

**Acceptance:** Publish a used camera with defects; change its price then verify old accepted order terms do not change; remove it and deny direct-link checkout.

<a id="global-disc"></a>
### GLOBAL-DISC — Discovery, saves and following

**Scope:** Core.

Canonical URL search/category/location/price/condition/sort, source-consistent listing detail, seller/store pages, private collections, follows, recent views and opt-in saved-search alerts. Keep bookmarks distinct from orders.

**Acceptance:** Return from an item with query/filter/scroll restored; saved sold items show sold rather than vanish; opt-out stops future alert delivery.

<a id="global-sell"></a>
### GLOBAL-SELL — Phone-first publishing

**Scope:** Core.

Create personal seller identity without mandatory business setup. Photo upload/reorder, autosave, fields, preview, publish/edit/withdraw and draft conflict recovery; business context selected explicitly.

**Acceptance:** Interrupt an upload, reload and finish a draft; switching to a business does not transfer a personal listing; foreign seller edits fail.

<a id="global-work"></a>
### GLOBAL-WORK — Business memberships and operations

**Scope:** Core.

One human may have a personal seller plus memberships in multiple businesses. Store/team/listing/inbox/analytics scope follows that seller. Owners and members have explicit capabilities; personal sellers cannot invite business teammates.

**Acceptance:** Revoked or wrong-seller members lose write/billing access; original listing ownership and past orders survive account-context switches.

<a id="global-msg"></a>
### GLOBAL-MSG — Messages and structured offers

**Scope:** Core.

Durable participant-only listing conversations, pagination/unread/retry, permitted attachments, block/report and structured offer/counter/expiry. Accepted offer/reservation is not payment. Expiry duration is product configuration, not copied from Drip.

**Acceptance:** Retry a send once, deny unrelated-reader access, expire an offer and preserve its history; accepted offer and checkout compete for the same unique item.

<a id="global-order"></a>
### GLOBAL-ORDER — Unique-item commerce

**Scope:** Core.

One unique listing, one seller and one currency per initial order. Server quote includes shipping/fees/tax policy. Atomic allocation, provider-verified payment and immutable terms; cancellation, returns, partial/full refunds, disputes and settlement complete the target.

**Acceptance:** Two simultaneous buyers cannot both purchase the one item; uncertain callback recovery produces one financial effect and cannot resurrect refunded access/stock.

<a id="global-plan"></a>
### GLOBAL-PLAN — Seller plans and exact quotas

**Scope:** Core.

Retain personal_free/personal_pro/business_free/business_pro. Versioned listing/draft/seat/history/export rules in billing.md are development defaults, not approved live offers. Enforce last-slot publishing and invitation quotas atomically.

**Acceptance:** Concurrent publishes at one remaining slot admit one; downgrade preserves current listings/members and order/support access while restricting new over-limit activity.

<a id="global-ai"></a>
### GLOBAL-AI — Editable buyer AI discovery

**Scope:** Core.

Translate natural-language needs to visible typed constraints against real public records, support Bulgarian/transliteration/model names and deterministic fallback. Preserve earlier hard constraints when refined. Buyer AI budget is not multiplied by seller switching.

**Acceptance:** A request for Sony under a budget returns no fabricated listing; unsupported constraints are explained rather than silently removed; switching seller does not reset use.

<a id="global-trust"></a>
### GLOBAL-TRUST — Trust, account and platform support

**Scope:** Core.

Reporting/blocking/reasoned moderation/appeals, eligible purchase reviews, account preferences/security/export/closure and access-limited support. Paid status cannot buy verification or immunity; reported off-platform sales are not verified purchases.

**Acceptance:** A removed listing stays removed after ordinary edits; a manually marked sale cannot create a verified-review receipt; export scopes to the requester.

<a id="global-insight"></a>
### GLOBAL-INSIGHT — Useful seller and operating metrics

**Scope:** Core.

Real views, inquiries, offers, orders, reported versus verified sales and subscription revenue remain distinct. Scope history/export to the plan, minimize telemetry and show honest empty states.

**Acceptance:** No sample graph on a new business; GMV excludes subscription revenue; analytics export and legal personal-data export have separate access.

<a id="global-expand"></a>
### GLOBAL-EXPAND — Retained expansion

**Scope:** Later.

Native, stock/variants, bulk imports, seller AI drafts, promotions, extra tiers/annual/trials, cross-border commerce, auctions and multi-seller carts stay named later workstreams. They are not created merely because the Shop clone has a similar control.

**Acceptance:** An expansion task states its new entities, authority and policy before exposing the feature; absent services never return fake success.

## Shared quality

Check the actual changed journey: input/error/empty/loading states, recoverable drafts, phone and affected desktop layout, Bulgarian/English copy, keyboard and Back/scroll behavior. Use focused checks while building, then end-to-end integration tests before release.

Private access is server-authorized. Price, stock/capacity, permissions and paid access are not controlled by browser state. Use exact money/quantity representations and test the relevant retry, concurrency and cross-account cases. Keep proposed or unknown facts distinct from confirmed data.

## Open decisions

- Confirm the live seller catalog and limits before enabling Pro; keep the recorded development values test-only.
- Confirm item-payment fees, shipping, tax, refund and settlement policies before live transactions.

These affect the named feature or live offer only. Implement other features and test adapters now; use explicitly labeled development configuration without presenting it as an approved public policy.
