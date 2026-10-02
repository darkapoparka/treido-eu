# Full feature map and end goal

September 30, 2026. Navigation/traceability for the complete Treido Global web target. [PRD](../prd.md) owns acceptance; the domain documents own detail; [tasks](../tasks.md) alone owns status. A row in this map is a requirement, not proof of implementation. The owner requested **EVERYTHING** for the first full web release; checkout, plans, boosts and assistants are included.

## Cross-cutting design acceptance

Every rendered feature uses its existing buyer or Studio component family from [UI patterns](ui-patterns.md), with the state and regression checks in [UI verification](ui-verification.md). Their separate typography/navigation must not be normalized into a new theme. A visually complete local preview does not complete the domain, persistence, authorization or provider acceptance in this feature map. T31 documents these rules; it does not close F01–F29 or replace their owning tasks.

## Observable end goal

A human can buy and sell personal goods, join or run businesses, discover either supply type, publish an honest listing from a phone, and complete a supported contact or on-platform purchase. A business can present its catalogue in the shared Shop storefront, manage staff/stock/imports/messages/orders, pay for useful tools and labelled promotions, and understand its results. Shopping assistants work on real inventory. Operators can resolve unsafe listings and commercial exceptions. Supported BG/EN web journeys remain polished on phones and desktop.

## Coverage

| Feature                                                     | Requirement                     | Owning contract                                                         | Delivery owner    |
| ----------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| F01 Human signup, intent, session recovery                  | GLOBAL-ONBOARD                  | [journeys](journeys.md#j02--sign-up-and-choose-what-to-do), marketplace | T04               |
| F02 Personal seller and multi-business authority            | GLOBAL-SELL, GLOBAL-WORK        | marketplace, data-model, backend                                        | T04/T10           |
| F03 Personal/Businesses public browsing                     | GLOBAL-SCOPE                    | marketplace, journeys J01, frontend                                     | T05               |
| F04 Full category catalogue, leaf policy and attributes     | GLOBAL-TAXONOMY, GLOBAL-CAT     | [categories](categories.md)                                             | T23               |
| F05 Recoverable drafts, uploads and publish/edit/withdraw   | GLOBAL-SELL, GLOBAL-CAT         | journeys J03, backend, data-model                                       | T06               |
| F06 Unique resale and stocked variants                      | GLOBAL-INVENTORY, GLOBAL-ORDER  | data-model, marketplace, billing                                        | T24               |
| F07 Real search, filters, facets and public detail          | GLOBAL-DISC, GLOBAL-CAT         | API, categories, frontend                                               | T07               |
| F08 Shared seller/storefront/info/reviews                   | GLOBAL-WORK, GLOBAL-TRUST       | marketplace, frontend                                                   | T03c/T07          |
| F09 Durable saves, collections and follows                  | GLOBAL-DISC                     | journeys J06, data-model                                                | T08               |
| F10 Messages, attachments, unread and block/report          | GLOBAL-MSG, GLOBAL-TRUST        | journeys J07, API, backend                                              | T09               |
| F11 Team invitations, permissions and recovery              | GLOBAL-WORK                     | journeys J04, data-model                                                | T10               |
| F12 Structured offers and common allocation                 | GLOBAL-MSG, GLOBAL-ORDER        | marketplace, billing, data-model                                        | T11               |
| F13 Quotes, seller onboarding, Stripe checkout              | GLOBAL-ORDER                    | billing, journeys J08                                                   | T12               |
| F14 Orders, fulfilment, cancellations and tracking          | GLOBAL-ORDER                    | journeys J09, API, data-model                                           | T12               |
| F15 Returns/cases/refunds/settlement/reviews                | GLOBAL-ORDER, GLOBAL-TRUST      | billing, journeys J09, operations                                       | T12/T27           |
| F16 Four seller plans, quotas and invoices                  | GLOBAL-PLAN                     | [billing](../billing.md)                                                | T13               |
| F17 Seller and operational metrics/exports                  | GLOBAL-INSIGHT                  | marketplace, operations, launch                                         | T13/T27           |
| F18 Business CSV import and stock management                | GLOBAL-IMPORT, GLOBAL-INVENTORY | journeys J05, data-model                                                | T25               |
| F19 Paid boosts and labelled sponsored slots                | GLOBAL-PROMO                    | [promotions](promotions.md), billing                                    | T26               |
| F20 Find for me/voice and Deal Finder                       | GLOBAL-AI, GLOBAL-MINIS         | [assistants](assistants.md)                                             | T15               |
| F21 Compare, Photo Match and Gift Finder                    | GLOBAL-AI, GLOBAL-MINIS         | assistants                                                              | T15               |
| F22 Compatibility and Sell Helper                           | GLOBAL-AI, GLOBAL-MINIS         | assistants, categories                                                  | T15               |
| F23 Saved-search alerts and transactional notifications     | GLOBAL-DISC, GLOBAL-MSG         | backend, operations, API                                                | T15/T09/T12       |
| F24 Reports, moderation, appeals and support                | GLOBAL-TRUST                    | journeys J12, operations, data-model                                    | T09/T27           |
| F25 Account preferences/security/export/closure             | GLOBAL-TRUST                    | journeys J12, data-model                                                | T27               |
| F26 Indexed queries, media delivery and measured cache      | GLOBAL-DATA, GLOBAL-DISC        | architecture, caching, testing                                          | T14               |
| F27 Isolated schema/providers, jobs and recovery            | GLOBAL-DATA, GLOBAL-LAUNCH      | backend, operations, data-model                                         | T04/T27/T16       |
| F28 Mobile/desktop continuity, BG/EN, SEO and accessibility | Shared quality, GLOBAL-LAUNCH   | styling, frontend, testing                                              | Each UI owner/T16 |
| F29 Real seller acquisition and measurable supply           | GLOBAL-LAUNCH, GLOBAL-INSIGHT   | [launch](launch.md)                                                     | T28               |
| F30 Country-by-country international growth                 | GLOBAL-EXPAND                   | launch, platform                                                        | T17               |

## Global expansion contracts

These are named end-goal workstreams rather than accidental controls inherited from Shop. Each gets an explicit implementation task under T17 when the owner selects its launch geography/use case:

- Additional countries: translated taxonomy/copy, currency/rounding, seller/provider eligibility, delivery/tax/rights/moderation/support and country-filtered supply; cross-border totals and settlement are independently qualified.
- Native apps: use shared safe contracts and authenticated use cases; mobile device/store acceptance and offline recovery are separate from the retained Expo scaffold.
- Auctions: bid authority, increment/expiry rules, anti-abuse, seller reserve, shared inventory allocation and winner/nonpayment recovery; no client countdown authority.
- Multi-seller payment: shipping/fees/tax for each seller, separate order obligations, partial failures/refunds and reviewed charge/settlement architecture; do not imply the v1 grouped cart already provides one combined charge.
- Advanced business tools: larger feeds/API integrations, annual/trial/higher plan versions, promotions with other delivery models and enterprise support; no silently expanded paid scope.
- Broader verticals: whole vehicles/property/services/digital/regulated categories require distinct entity/policy/fulfilment contracts. They are not exposed through a Miscellaneous leaf or by importing old donor arrays.

The complete first web target includes F01–F29. The full international end goal also includes F30 and the selected expansion contracts. Task status and enabled production features must agree; unfinished functionality cannot be represented by sample success.
