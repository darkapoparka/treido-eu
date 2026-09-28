> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Buyer website contract

Owner: buyer routes/components in `apps/web`. Scope: a real responsive browser application, not Expo rendered on the web. Current work is Shop parity; the manufacturer-first food experience below is the required destination after source approval, not permission to rebrand now.

## Experiences

Support producer discovery -> producer storefront or food search -> product -> variant/quantity -> cart -> checkout -> confirmation -> purchase tracking -> help/recovery. Saved items/collections, followed producers, profile/settings, addresses and notifications return users to the correct context. Public browsing and a guest cart do not require sign-in; the current initial checkout policy requires authentication with deterministic cart merge and destination recovery.

BUY-001 through BUY-010 and ACC-001 through ACC-003 are specified in [product requirements](docs/product/requirements.md). This contract refines their food-specific experience. [design.md](design.md) owns the frozen visual source. No generic ecommerce theme replaces it.

## Current reference phase

Use the existing buyer shell, shared card/dialog/sheet/navigation owners and real DOM controls. Map source frame -> route/query -> named fixture -> actual actions -> overlay/scroll/focus -> evidence. Route hints and isolated screenshot pages are not complete journeys. Source-specific features still need explicit states and honest service boundaries before real AI, payments or integrations exist.

The source comparison frame is 393 x 793 browser content, with the documented normalization in design.md. Check relevant 320/430 containment. Wider compositions are deliberate adaptations, not stretched screenshots or a separate component tree hidden by CSS.

Preserve browser Back/Forward, deep links, query/filter state, scroll restoration and focus return. Closing a child sheet must not dismiss its parent. A tab or control must not navigate to a blank history entry. Page refresh and loading state must not silently reset a cart or misreport a completed payment.

## Food homepage: producer containers, after source approval

The primary feed unit is a **producer shelf**: one clearly identified manufacturer/producer and a collection of its foods. Do not substitute a generic product grid with occasional seller names. This is the owner's product direction from 2026-09-12. Exact styling comes from the approved Shop foundation and the later food adaptation review, not invented pixel measurements here.

| Layer | Required buyer experience |
| --- | --- |
| Discovery controls | Search foods and producers, browse approved food categories, and choose or change the shopping area/fulfillment context. Provide manual selection and browsing when geolocation is unavailable; never silently invent a location. |
| Producer header | Recognizable producer name and available identity media, optional factual region/description, useful follow state, and a clear link to the full storefront. Display reviewed trust information only when supported. Missing images get a neutral fallback, not a fabricated logo. |
| Producer product shelf | The producer's eligible food cards grouped beneath that header. Mobile uses the source-derived rail/container pattern; wider layouts keep the same producer grouping. Bound and paginate the feed instead of loading every seller/product at once. |
| Food card | Actual image or honest fallback, food name, price/currency and meaningful pack or selling unit, plus relevant availability. Opening a card goes to that exact product/variant context. Quick add is allowed only when a valid default choice and quantity exist; otherwise open the selection flow. |
| Returning buyer context | Followed producers and buy-again entry points when actual saved/purchase state supports them. Keep general discovery usable for a signed-out or first-time buyer; do not fake activity or reorder history. |

A shelf for one producer must not quietly contain another seller's stock. Where an approved reseller offers another manufacturer's food, retain the distinction between seller and maker; do not award the reseller a producer claim by relabeling it. Producer location, origin and deliverability are independent fields.

The marketplace controls overall feed composition/ranking. A merchant controls its own eligible public store/content, not other manufacturers' shelves or platform trust badges. Start with an explicit deterministic selection/order policy; later personalization must be an implemented, evaluated capability. Seasonal/local/promoted labels require applicable facts and disclosure; no random ordering presented as intelligent recommendations.

The public feed, storefront and search read the same current published catalog projections. Do not maintain a second hardcoded homepage catalog or copy private merchant/customer data into a public response. New publication or suspension updates the affected projections. Filter changes have stable URL/state semantics and a clear reset path.

### Feed states and actions

Loading preserves the producer/card geometry. An empty marketplace, no matching foods in the chosen area/category, no followed producers, an unavailable item and a request failure have distinct useful messages/actions. Do not fill empty states with reference brands. Keep partial failure within its affected shelf where possible; retries must not duplicate cards or lose the buyer's location/filter/scroll context.

Tap a producer header or store action -> that producer's storefront. Tap a product -> its detail. Follow/unfollow -> consistent feed/store/account state, with sign-in continuation when required. Back from a store/product -> previous feed filter and scroll. Reorder -> a new cart selection reviewed against current price, stock and fulfillment, not automatic payment.

## Food storefront and product evaluation

A storefront presents producer identity/story and current food collections, with search/categories, follow/contact entry and actual delivery/pickup information. It consumes the public output of [the seller CMS](app.md); draft previews stay separate from published buyer content. The storefront, shelf and product detail must agree on identity and offer facts.

A listing needs actual variant/price/currency, a meaningful unit or pack size, minimum/increment, availability and configured delivery/pickup. Product evaluation exposes applicable ingredients/allergens, storage/origin and traceability facts without fabricated badges. Compare price per declared selling unit; do not confuse a six-pack with one item or quoted weight with actual-weight charging. Unknown allergen information must remain distinguishable from an explicit declaration.

Search includes foods and producers, the approved category hierarchy, BG/EN queries and source-backed facets. Replace irrelevant general-merchandise facets with applicable food/category attributes during adaptation; do not merely translate color/size/fashion labels into unrelated food concepts. Dietary/allergen filters use reviewed structured facts and preserve unknown states. A discovery suggestion does not guarantee a food is safe for a particular person.

Mixed-seller purchase grouping, fees and fulfillment presentation follow approved DEC-002, never the source's incidental one-seller example. Show the responsible seller and actual fulfillment choice for each group. Requote changed prices/stock/offers explicitly and require review before payment.

## Adaptation and acceptance

Task 7 must demonstrate a connected food experience, not just a logo/category swap. Use deterministic synthetic food producers until real services are connected and label that boundary. Preserve source fixtures in isolated reference mode for historical evidence; the food product must not serve captured Glow/general-shopping brands, non-food recommendations or demo seller inventories as real catalog content.

Required food-adaptation evidence includes:

- At least two distinct synthetic producers with multiple foods each: every shelf, storefront and product link retains the correct producer/offer identity; mixed-seller cart behavior follows the approved or explicitly fixture-only policy.
- A new buyer can browse/search, open a producer, select a valid food quantity, reach cart/checkout and return without losing context. A returning buyer's follow/reorder paths use actual fixture or persisted state, with that scope disclosed.
- Missing identity media, long BG/EN names, sold-out/changed offers, no area matches, loading/error/retry and narrow/wide layouts remain usable; no invented ratings, prices or delivery promises fill gaps.
- Once Tasks 4/8 services exist, seller publication updates the storefront and eligible feed/search projections; drafts remain private and suspension removes orderability. Source-only UI evidence cannot satisfy this persistence check.

Server Components and feature services own reads where appropriate. Keep interactive client boundaries narrow; do not move permissions or totals into browser state. Isolated reference adapters feed the same components used by real data. No fixture fallback on provider failure and no production shipping of restricted source content.

Test keyboard/focus, accessible names, reduced motion and important screen-reader journeys. Source matching does not excuse inaccessible controls. Batch completion remains scoped: implemented states, exercised interactions, visual evidence, sibling regression and required real-service tests. Reference screens alone do not establish working checkout, orders or identity.
