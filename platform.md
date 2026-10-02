# Platform — what Treido is

## Design and delivery contract — October 2, 2026

Preserve the Shop-derived buyer experience and the separately scoped Shopify-derived seller Studio, with the approved Treido artwork, phone copy and marketplace adaptations. [UI patterns](docs/ui-patterns.md) names component and interaction owners; [UI verification](docs/ui-verification.md) defines acceptance. A personal seller is not required to open a business storefront. Public supply scope remains independent of the authorized operating seller.

The broad device-local `/admin-preview` is not a completed commerce backend. Real private `/app` adapters exist, while live binding and feature qualification remain in [tasks](tasks.md). [Documentation ownership](docs/documentation.md) routes implementation without another planning cycle.

## Final foundation decision — 1 October 2026

**Continue Global in this existing Shop-derived app.** The only other active Treido product is Foods at `L:/PLATFORMS/treido-bg-shop`. BG Wolt and BG Next are preserved donors. E Global, older Treido and Amazong are sources of reviewed domain logic and tests, not competing implementation queues.

Shop is selected for product/seller presentation, collections, saved/follow continuity and purposeful shopping tools. Global must also deliver classifieds essentials: relevant search, visible condition and location, personal/business disclosure, fast listing creation, messaging/offers and supported handover. A storefront-only Home is insufficient for a person selling one used item. Preserve the visual language while making these differences explicit in [styling](styling.md).

Keep Global and Foods separate in deployment, domain authority, inventory, orders and fulfillment. A Marketplace / Foods link may connect their navigation; shared sign-in needs an explicit identity contract. Do not merge their carts or introduce a third hybrid app. Both already use Next.js.

Close the source election. Revisit only if the core product promise changes or a measured constraint cannot reasonably be solved in this app. New reference screenshots, old code volume and the presence of an AI chat screen do not decide architecture. Shipping every requested feature remains the full target; this decision does not certify launch readiness.


**End goal, September 30, 2026:** one general ecommerce and resale marketplace with personal sellers, business stores, real inventory/commerce, useful shopping assistants and controlled international growth. Work in `L:/PLATFORMS/treido-eu-global`, existing `app/`; keep the Shop-derived frontend as the shared product surface. The owner requested the full first web release for October 1 morning, Europe/Sofia; [launch](docs/launch.md) defines that target and [tasks](tasks.md) records actual completion.

Treido helps someone find a specific item, understand its condition and seller, ask or make an offer, and complete a supported handover. The same person can sell from a phone without first opening a business. Businesses get a distinct public identity, controlled team access, inventory operations and useful seller tools.

## The experience we are building

A familiar, polished shopping experience with resale-grade information and trust. Keep the existing Shop-derived layout, typography, cards, galleries, overlays, navigation and motion. Replace merchant-only assumptions and reference data, not the visual language.

The personal/business browse selector is an explicit supply filter: browse people or businesses without changing account ownership. The same listing card, seller surface and search experience work in both modes. Condition, defects, delivery, seller status and applicable policies make the choice useful; a business badge must not imply that every product is new, verified or under a commercial warranty.

## Product priorities

**First:** dependable listing creation, relevant discovery, clear seller identity and communication. A buyer should know what is being sold and a seller should not lose a draft. A reported item must reach a real moderation workflow.

**Complete first web target:** business memberships/storefronts, unique and stocked listings with variants, catalogue imports, structured offers, supported checkout/fulfilment/refunds, seller plans, labelled boosts, assistants and operator/account support. Implement these in dependency order; the owner selected all of them rather than a listing-only release. An accepted offer is not payment; a manually marked sale is not a verified transaction.

**International end goal:** country profiles and supported cross-border operations, native clients, auctions, unified multi-seller payment and larger enterprise integrations under explicit contracts. Stock/variants, imports and boosts moved into the first full web target on September 30. A grouped cart creates one checkout/order per seller and currency until a combined-payment contract is qualified.

## People, businesses and shopping tools

Signup creates one human identity and asks skippable Buy / Sell my items / Sell as a business intent. Personal selling starts the human's single personal seller; business selling creates or joins a separate authorised business account. Buyers do not need to register a business to browse. Existing personal listings are not converted when someone starts a business.

Personal/Businesses is public supply discovery, not a login role. Mixed All is the default and reset; explicit Personal or Businesses mode includes only that seller kind across search and assistant results. Seller type remains independent of new/used condition, verification, warranty and paid plan. Both modes use the same visual system and shared seller presentation.

Minis becomes Shopping tools: Find for me (including editable voice), Deal Finder, Compare, Photo Match, Gift Finder, Compatibility and Sell Helper. Results are grounded in real eligible Treido listings; seller drafts and any writes remain reviewable ordinary product actions. [Assistants](docs/assistants.md) defines the tool/runtime/evaluation contract.

## Positioning hypothesis

Combine the breadth and direct seller contact of classifieds with consistent mobile shopping and clearer personal/business discovery. This is a hypothesis to validate, not evidence that competitors lack these features. [Research](sources.md#marketplace-research) shows business storefronts, listing management and condition detail are already competitive expectations.

Start with legal, supportable physical-goods categories in Bulgaria, Bulgarian and English copy, and local handover needs. A broad taxonomy does not mean “all regulated goods” or every country on day one. Build country, locale and currency into contracts rather than scatter hard-coded assumptions through components.

## What success means

Measure the real loop: draft completion, successful publication, qualified inquiry, seller response, time to reported/verified sale, repeat use and support outcomes. Keep safety/fraud and cancellation rates beside conversion. Never combine seller-reported sales with provider-verified orders or subscription revenue with merchandise value. Numeric targets follow real baselines, not fabricated dashboards.

[PRD](prd.md) owns acceptance; [features](docs/features.md) maps the full target; [categories](docs/categories.md) defines the catalogue; [journeys](docs/journeys.md) answers signup/selling/buying; [billing](billing.md) owns commercial policy. [Tasks](tasks.md) alone owns implementation progress. Strategy and specifications never imply that a backend, paid feature or release is already working.
