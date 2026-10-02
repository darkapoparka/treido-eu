# Listing boosts and sponsored discovery

September 30, 2026. Owns `GLOBAL-PROMO`. The owner requested listing boosts in the full web release. [Billing](../billing.md) owns the recommended commercial catalogue and payment lifecycle; [API](api.md) owns commands. This specification creates no Stripe products or live campaigns.

## Products and seller journey

| Versioned product          | Proposed delivery                                         | Product contract                                                                                                    |
| -------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `bump_once_v1`             | one eligible freshness event after confirmed payment      | changes the listing's promoted freshness signal once; does not alter original publication history or guarantee rank |
| `category_spotlight_7d_v1` | seven days of eligible category/search sponsored rotation | only matching category/country/seller scope; visible Sponsored label; rotation and finite slots                     |
| `home_spotlight_7d_v1`     | seven days of eligible discovery rotation                 | eligible scoped feed placement; capacity/inventory and expected delivery explained before purchase                  |

Seller selects an owned eligible listing, sees placement/duration/scope and exact prospective total, then confirms checkout. The server resolves price/product version and current marketing capability. Pro is not required to buy a boost. Purchase receipt identifies the campaign, serving interval, delivery contract and cancellation/refund policy. No promised number of buyers, sales, views or ranking uplift.

Recommended v1 is duration/rotation-based promotion, not CPM/CPC billing. Capacity must be sufficient before a sale is accepted; use a transactional allocation or bounded waitlist rather than selling undeliverable slots. Do not sell “front page forever” or a guaranteed top position for every competing listing.

## Eligibility and ranking

Only published, available, policy-approved listings from unrestricted sellers can be served. Unique sold/allocated-to-another-buyer listings and unavailable SKUs stop serving as applicable. Campaigns preserve hard query/category/price/condition/location/currency/seller-kind constraints. Business-only feeds never accept a personal campaign. Paid listing ineligibility cannot be bypassed by an old cached campaign.

Organic and sponsored results remain distinct. Proposed starting placement cap: at most one sponsored card per eight visible listing cards, no duplicate of the same listing on one page, and at least one eligible organic result before adding sponsored results. Keep the existing card/grid dimensions; Sponsored is an explicit bounded copy/badge change. Empty results remain empty when no paid listing actually satisfies the query.

Default ranking combines deterministic relevance, eligibility, freshness and measured quality. Paid delivery occupies labelled slots; it never fabricates organic relevance, verified reviews or seller verification. Assistant results use the same eligibility and disclose any sponsored insertion separately.

## State and financial behaviour

Campaign states: draft → awaiting_payment → scheduled → active → completed, with cancelled/paused/reconciling alternatives and an explicit reason. Store purchased product/terms/price and serving interval immutably. Stripe verified payment grants one campaign; duplicate events cannot restart/extend it. Activation waits for actual eligible serving capacity. Server/database time is authority; no browser countdown decides expiry.

Stopping rules distinguish seller choice, sale, moderation, account restriction and platform/provider failure. A normal seller withdrawal/sale ends serving under the accepted terms; a platform-caused inability to start/deliver receives the defined remedy. Proposed policy is automatic full refund for a campaign that never starts because of platform failure, and reviewed prorated credit/refund for platform-caused interruption. Exact legally reviewed terms are confirmed before public sale. A moderation stop never silently transfers a campaign to another listing.

Promotion invoices/refunds use promotion purpose and campaign mapping, separate from seller subscriptions and item orders. Unknown provider outcomes remain reconciling with stable attempt keys. No auto-renewal or automatic seller-wallet spend in v1; further paid effects require their own explicit product consent.

## Honest reporting and operator controls

Seller sees purchased interval, actual eligible impressions, clicks, inquiries and current serving/stop state. Deduplicate placement/request identity and exclude known test/operator/bot activity under a documented event policy. Inquiries and orders are attributed with clear windows and never asserted as caused by a promotion merely because they followed it.

Marketing capability can manage a business campaign; billing/refund capability is separate. Operators can pause an unsafe campaign with a reason and audit, review delivery failures/refunds, and inspect aggregate delivery/capacity. No raw private buyer histories are exposed to sellers.

## Acceptance — T26

Test foreign seller IDs, removed marketer/billing membership, wrong/duplicate/out-of-order provider events, one remaining placement slot, publication/moderation/sale changes, scope mismatch, expiry and restart, provider timeout, never-started delivery compensation and duplicate metrics. Browser checks cover preview → pay/pending → active → ended, empty inventory, invoice/refund and Sponsored rendering at mobile/desktop sizes. Live promotion requires these results plus approved price/terms/provider mappings; the specification alone marks no campaign working.
