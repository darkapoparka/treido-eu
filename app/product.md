> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Product: Treido

## The destination

Treido is a modern, manufacturer-first food marketplace and seller operating platform. People discover who grows or makes their food, browse that producer's products, understand the offer, buy, and follow fulfillment. Producers manage their storefront, catalog, stock, orders and customers in the same platform. AI helps those journeys; it is not the product's identity or a prerequisite for ordinary buying and selling.

In this product, manufacturer/producer includes farmers, growers, beekeepers, dairies, bakeries and other eligible food makers, not only large factories. Small-scale and home-produced foods belong to the intended experience where the approved seller/category policy permits their sale. This direction does not approve every home kitchen, food claim or category automatically. Other food-business, business-buyer and partner requirements remain explicit, not silently removed.

Initial market direction is Bulgaria with Bulgarian and English experiences. Language, market, currency and time zone are separate concepts. This is a NEW implementation in `treido-bg`, retaining its existing work. `treido-next` is optional domain context for a specific question, not a required schema, UI, architecture or code import. No real-data migration is authorized by this specification.

## The experience we are building

**Discover producers, not an anonymous wall of unrelated products.** The homepage's primary merchandising unit is a manufacturer container: an identifiable producer followed by a shelf of that producer's foods. A buyer can open the producer's store, follow it, or open one of its products. Search and category browsing complement this feed; they do not erase producer identity. [web.md](web.md) owns the concrete homepage structure, states and acceptance.

Illustrative content only, not approved sellers, seed data or fulfillment promises:

```text
Treido Home
  Search foods and producers; chosen delivery/pickup area
  Food categories
  Vegetable grower -> tomatoes, carrots, herbs
  Beekeeper         -> the producer's honey products
  Dairy producer    -> yogurt, cheese
  Bakery            -> bread and other eligible baked foods
  Followed producers / buy again when real user history exists
```

**Evaluate the food.** The buyer sees who makes and sells it, what the pack or selling unit contains, its actual price and availability, relevant food information, and configured delivery or pickup. Producer location, product origin and delivery eligibility are different facts. Unknown facts are not invented to fill a badge.

**Purchase and return.** A buyer selects a sellable variant and valid quantity, reviews seller groups and charges, pays through the supported service, follows each fulfillment and can obtain help. Following and repeat purchasing make returning to a trusted producer easy. A reorder revalidates current offers; it does not replay old prices or unavailable stock.

**Run a food business.** A producer can create a store, present their story and foods, publish valid listings, manage stock and fulfillment, answer customers and understand actual sales. The seller CMS in [app.md](app.md) connects draft/preview/publish/version/rollback to the public store. It is not a decorative dashboard or a second manually maintained catalog.

**Use AI where it earns its place.** Buyer discovery can interpret a food/product request against actual catalog data. Seller assistance can draft listings and translations, summarize order work and draft replies. [ai.md](ai.md) owns feature enablement, grounding and evaluations. The shopping and operating flows remain useful without AI; no invented food facts, stock, certification or autonomous purchasing.

## One product, distinct surfaces

| Surface | Contract | Purpose |
| --- | --- | --- |
| Buyer website | [web.md](web.md) | Producer discovery, product evaluation, purchasing, account and recovery in the browser |
| Native buyer app | [native.md](native.md) | iOS/Android buyer journeys with the same producer-first product hierarchy and commerce API, not shared DOM components |
| Seller operating platform | [app.md](app.md) | Onboarding, catalog, inventory, orders, finance, teams and storefront CMS |
| Platform administration | [admin.md](admin.md) | Separately privileged verification, moderation, support and exceptions |
| AI assistance | [ai.md](ai.md) | Permissioned drafts, retrieval and analysis inside the above workflows |

A person can buy and belong to selling businesses. Switching workspaces never grants authority. Merchant and platform roles are not interchangeable. The native app is not a second server or a promised native merchant dashboard.

## Build sequence and gates

**1. Finish the Shop buyer reconstruction.** Reproduce the frozen screens AND ordered interactions in canonical components, including overlays, forms, empty/error states, navigation, focus and scroll. Current execution targets mobile-width web. Preserve all source obligations, including assistant/voice/Minis/widgets and their explicit platform boundaries. Keep captured brands/products while comparing. This phase is not the final food product.

**2. Approve the source and establish the design system.** Evidence is scoped to source IDs, platform, state and source revision. Extract measured shared patterns while building; freeze their accepted values and named exceptions before branding. A numerical score alone is not 1:1 approval.

**3. Adapt the same implementation into Treido.** Build the producer-and-products homepage described above, food storefronts and product evaluation, category-specific search, units/packages, applicable food facts and configured fulfillment. Replace general-shopping fixtures and branding, not just their labels. Retain the proven component, navigation and interaction foundation; make intentional food-specific composition changes through those owners. There must not be a throwaway clone or two permanent competing homes/skins.

**4. Complete real commerce and seller operations.** Connect the buyer components to authoritative identity/catalog/stock/payment/order services and the full seller/CMS workflows. Only published, eligible public projections supply storefront/search/feed content. Seller publishing must not require a developer to edit a homepage array. Real-service requirements remain open even when visually approved fixtures exist.

**5. Complete native, AI, platform operations and release qualification.** These are explicit workstreams, not implied capabilities of a scaffold. Release needs integrated evidence and separate authorization. Backend work retains its actual dependencies in the numbered tasks; this narrative does not silently reorder those work packages.

The current implementation phase remains phase 1. The owner's 2026-09-12 clarification establishes the manufacturer-first destination; it does not accept current Shop parity or start branding. Execute through [tasks.md](tasks.md), not a second roadmap.

## What Treido is not

The final buyer experience is not a general merchandise marketplace populated with captured Glow or other reference brands, cosmetics, fashion or random demo sellers. Such content belongs only to the isolated comparison corpus/fixtures and must not leak into the food product's routes, search, recommendations or release assets.

It is not an unreviewed theme change that discards Shop's working flows, an automatic nationwide delivery service, or a copy of Shopify's underlying backend. Shopify is a seller UX reference where inspected; Treido's seller operations and food-specific rules are its own product. Reference-only features need an explicit adaptation/removal/defer decision after parity rather than silent disappearance during parity.

## Requirements that cannot disappear during restructuring

[Detailed requirements](docs/product/requirements.md) retain the full contracts, food taxonomy/quantity proposal and worked commercial examples. This product direction and web.md refine BUY-002/003/004/005/010; app.md refines MER-008. They do not replace requirement IDs or authorize dropping other features.

| Family | IDs | Scope |
| --- | --- | --- |
| Buyer | BUY-001 through BUY-010 | Shell, discovery, search, stores, products, cart, checkout, purchases, recovery, saved/trust |
| Accounts | ACC-001 through ACC-003 | Identity, addresses/preferences, business membership and selling entry |
| Seller | MER-001 through MER-010 | Onboarding, catalog, bulk, inventory, fulfillment/orders, customer work, finance, store/team, Premium, AI |
| Communication | COM-001, COM-002 | Durable conversations and notifications |
| Platform | ADM-001, ADM-002 | Privileged operations and disclosed promotions |
| Partners | OPS-001 through OPS-003 | Supplier relationships, pickup/delivery coordination and assigned drivers |
| Native/quality | NAT-001 through NAT-003, QUA-001 | Buyer app, lifecycle, release and cross-cutting quality |

Core merchant customer service and correct commerce must not require Premium or AI.

## Commercial and food truth

Preserve the existing headline policy: buyer protection/service fee of **5% + EUR 0.50 per order**, **0% seller commission**, and separately configured fulfillment charges. The detailed fee base, parent/seller-order grouping, allocations, rounding and refund policy remain an **unapproved proposal under DEC-002**. This document does not approve pricing, settlement responsibility or live payments.

A product owns listing content; a variant is the sellable SKU, including a default variant for simple products. Exact units, package quantities, minimums/increments, stock and fulfillment eligibility matter. Unknown ingredients/allergens are not safe absence. Homegrown, organic, local, certification and origin claims require supporting facts under the approved policy, not inference from an image or AI.

See [the decision register](docs/product/decisions.md). Legal, tax, privacy, food-policy and provider review precede public release. Documentation, source imitation and AI review are not compliance certification.

## Success

A buyer can discover a producer, understand and buy its foods, and return to it without confusion. A seller can publish and manage those offers without code changes. Payment, stock and fulfillment reconcile with matching buyer-visible state, including recovery. Website, native app and workspaces remain useful through failure, stale data, revoked access and interrupted journeys. Every declared requirement is evidenced or openly deferred in an approved release envelope; none becomes Done by omission.
