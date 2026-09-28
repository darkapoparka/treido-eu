# Detailed product requirements

> Retained food/commerce/feature requirements, including UNAPPROVED worked policy proposals. Current direction and phase order are owned by ../../product.md; current decision status is owned by decisions.md. Historical Task 2 or source-status notes below are not fresh implementation evidence.

This document defines WHAT to build. It is a standalone product contract, not a description of an existing implementation. [design.md](../../design.md) defines appearance and interactions; [architecture.md](../../architecture.md) defines engineering boundaries; [tasks.md](../../tasks.md) defines execution and evidence. No application functionality is complete merely because it is specified here.

> Retained detailed requirements and unapproved policy examples from 2026-09-08, reorganized 2026-09-12. Root product.md owns the current manufacturer-first direction and phase order. docs/product/decisions.md owns CURRENT decision status. Historical Task 2 notes below are proposals, never proof of implementation or approval.

## 1. Product

Treido is a food-first marketplace and operating platform connecting buyers with real producers, shops and other food businesses. Start with Bulgaria and Bulgarian/English experiences. Model market, currency, language and time zone separately so additional markets do not require another commerce engine.

The product consists of a shopping experience, personal/business accounts, a full merchant operating dashboard, platform administration and a native buyer application. A shopper can also sell through an authorized business without creating a second personal identity.

The buyer frontend is a NEW implementation of the selected Shop reference: styling, typography, layout, navigation, transitions and complete flows. After reference approval, adapt that implementation to Treido's branding, food categories, producers and commerce details. It is not a reskin of a previous Treido frontend. The buyer Shop reference does not define merchant/admin presentation. The current seller reference and CMS contract are owned by app.md and shopify/README.md at the repository root; platform administration has a separate contract.

## 2. Users and entry points

| Actor | Needs |
| --- | --- |
| Visitor | Browse/search, inspect products and sellers, build a guest cart, then sign in without losing the selection or destination. |
| Personal buyer | Buy, track purchases, communicate, manage addresses/preferences, save items, request support and submit eligible reviews. |
| Business buyer | Purchase in an authorized business context with business contact/invoice details; see only permitted business records. |
| Merchant member/manager/owner | Run the business through role-appropriate catalog, inventory, fulfillment, orders, customers, finance, team and settings tools. |
| Platform operator | Perform explicitly granted verification, moderation, support and exceptional commerce operations with an audit trail. |
| Delivery/distribution partner | Carry out the explicitly configured partner workflows in section 6, with restricted assignment/resource access. |

Public browsing does not require authentication. Initial checkout requires sign-in. Guest checkout is not assumed. Personal account and the selling dashboard have different navigation. Switching to selling selects or creates an authorized business; it never grants permissions merely by changing the interface.

The native application serves buyers on iOS and Android. The complete merchant dashboard works on desktop and mobile web. A native link to selling may open that dashboard with tested authentication and return behavior; it must not be described as a native merchant application.

## 3. Feature contract

IDs identify requirements, not implementation status. A feature must work across its declared clients/locales, with real data, permissions and actionable loading/empty/error states. Its tasks record what has actually passed.

### Shopping

| ID | Build | Required observable behavior |
| --- | --- | --- |
| BUY-001 | Buyer shell/navigation | Shop-matched chrome and navigation; useful initial controls, correct selected state, back/forward and scroll restoration; no unexplained visual changes between routes. |
| BUY-002 | Home and food discovery | Catalog-driven product/store shelves and category hierarchy; valid destinations, honest promotions/ratings/availability, useful empty states. Food labels are applied in the Treido adaptation phase. |
| BUY-003 | Search/filter/sort | Product and seller results; category-specific facets, location/fulfillment filters, bounded pagination, shareable web query state and stable ordering. Evaluate Bulgarian/English queries, typos, synonyms and transliteration. Recover from no results. |
| BUY-004 | Storefront/location discovery | Public seller identity, location, verification and catalog; save/follow where specified; usable map/list interaction and denied-location fallback. Never invent proximity or delivery eligibility. |
| BUY-005 | Product detail | Images, description, seller, options, price/currency, unit/package, minimum/increment quantity, stock/orderability, fulfillment, relevant food facts and review summary. Adding an item always identifies a sellable variant. |
| BUY-006 | Cart | Add/update/remove variants, seller grouping, guest persistence, authenticated ownership and deterministic sign-in merge. Explain changed price, unavailable stock, invalid quantities or incompatible fulfillment instead of silently altering the purchase. |
| BUY-007 | Checkout/payment | Address or pickup selection, eligible fulfillment, server quote, disclosed fees, review and confirmation. Repeated submission, provider challenges, interrupted return and failed payment must recover without duplicate orders or charges. |
| BUY-008 | Purchases/tracking | Owner-scoped history and detail, purchased snapshots, payment/commercial/fulfillment timeline, per-seller progress when applicable, actionable delays or exceptions. |
| BUY-009 | Recovery/support | Cancellation, return/refund request and order issue entry according to approved policy; visible request/outcome history, supported money/stock effects and accessible escalation. Unsupported operations explain the limitation. |
| BUY-010 | Saved items and trust | Saved products/sellers, verified-purchase review eligibility, separate product/seller reputation, seller replies, reporting/moderation and empty reputation states without fabricated scores. |

### Accounts

| ID | Build | Required observable behavior |
| --- | --- | --- |
| ACC-001 | Identity/personal account | Sign-in/up/out, account recovery, personal details, language, sessions and account-removal request. Authentication resumes the intended journey with the correct cart. |
| ACC-002 | Addresses/preferences/receipts | Owner-scoped addresses, communication/privacy preferences, receipts/invoices and provider-managed payment methods where enabled. Do not store raw card details. |
| ACC-003 | Businesses and selling entry | Business creation/selection, onboarding, invitation acceptance, membership/role lifecycle and suspended/removed-member handling. A personal identity is not business authorization. |

### Merchant operating dashboard

| ID | Build | Required observable behavior |
| --- | --- | --- |
| MER-001 | Business onboarding and home | Collect business/contact/verification information, show submission status, select a workspace and surface real attention queues: unconfirmed orders, low stock and operational exceptions. |
| MER-002 | Catalog/variants/media | Create drafts; edit content, category/attributes, variants/options/SKU/barcode, units/packages/quantities/prices and fulfillment eligibility; upload/reorder/delete media; publish/archive with explicit validation. |
| MER-003 | Bulk tools | Catalog import/export and useful bulk edits; preview validation and row errors, defined atomicity and retry behavior. No silent partial corruption or cross-business export. |
| MER-004 | Inventory | On-hand, reserved and available quantities per variant; auditable adjustments with a reason; applicable locations/lots/expiry. Concurrent checkout cannot oversell; release/consumption cannot be applied twice. |
| MER-005 | Orders and fulfillment | Configure pickup/delivery methods, locations/windows/fees/instructions; filter the order queue; inspect purchased facts; confirm/decline and progress eligible fulfillment; handle exceptions and approved refunds/cancellations. |
| MER-006 | Customers/inbox/reviews | Authorized customer/order context, durable conversations, unread state, attachments, search, customer history, review replies and report/block/escalation. |
| MER-007 | Analytics/finance | Date-scoped sales, refunds, discounts, fees, supplied costs, calculable profit and payout/settlement records. Drill from totals to records; unknown costs are not zero and revenue is not profit. |
| MER-008 | Store/team/settings | Public storefront identity/content, contact/business settings, invitations/roles/removal and notification preferences. Financial/team/admin privileges are enforced on the server. |
| MER-009 | Free/Premium | Configured subscriptions, entitlement enforcement, invoices/portal, downgrade/failure recovery and accurate limits. Basic commerce correctness and ordinary customer service are not premium-only. |
| MER-010 | Permissioned AI assistance | Listing drafts from authorized photos/input; category/attribute/translation suggestions; operational summaries; metric-backed analysis and inventory signals; buyer-reply drafts. Approval precedes consequential actions; costs and failures are bounded. |

### Communication and administration

| ID | Build | Required observable behavior |
| --- | --- | --- |
| COM-001 | Live conversations | Authorized inbox/thread, stable message order, send/retry/deduplication, pagination/reconnect, private attachments and block/report. Delivery and read receipts are distinct. Durable history agrees across clients. |
| COM-002 | Notifications | Durable in-app events and enabled email/push delivery, preference-aware retries/deduplication, unread state and secure deep links. Optional providers do not block initial shopping. |
| ADM-001 | Platform operations | Privileged verification and moderation queues, reports/reviews, support and commerce exceptions, operator permissions and auditable decisions. Normal merchants cannot access these tools. |
| ADM-002 | Promotions | Clearly disclosed promoted product/store placements with eligible content, configured scheduling, tenant-safe management and honest attribution. Organic content is not secretly labeled as paid or vice versa; commercial activation requires configured terms. |

## 4. Required transaction journeys

### Merchant publishes; buyer purchases

A merchant creates a draft product and at least one variant. Publishing checks the required content, price/quantity rules, inventory policy and available fulfillment. An eligible published product appears in discovery. A buyer selects the variant and quantity, reviews cart/fulfillment/charges and confirms. The server validates current facts and records the operation. Verified payment outcome produces the appropriate order state. The merchant receives an authorized order and progresses allowed fulfillment. Buyer and merchant views show the same underlying result.

Acceptance includes two buyers competing for the last quantity, a price change before confirmation, repeated confirmation, a failed/interrupted payment and a merchant attempting another business's order. A disabled button is not concurrency protection.

### Customer issue and review

From a purchase, the buyer opens an allowed issue/cancellation/refund request or contacts the seller. The responsible merchant/operator sees context and performs only permitted actions. The outcome is durable, notifications link to it and repeated processing cannot duplicate money/stock effects. After eligibility is satisfied, the buyer can submit the allowed product/seller review. Ineligible or duplicate reviews are rejected with useful feedback.

### Daily merchant operations

A merchant sees actual work needing attention, filters the order queue, completes allowed fulfillment, adjusts inventory with a reason, answers customers and reconciles displayed totals to orders/refunds/payouts. An invitation grants only its configured role; removal revokes access and clears stale client context. No chart or queue is filled with fake production values.

## 5. Commercial and catalog rules

The current product policy is a buyer **Treido Protection and Service Fee of 5% plus EUR 0.50 per order**, **0% seller commission**, and separate configured fulfillment charges. Implement a single server policy and immutable order fee snapshots. Detailed fee base, rounding, order grouping and refund allocation require DEC-002; the headline policy alone is not an executable calculation specification. Do not invent foreign-currency conversions.

Protection means issue review/support, not insurance or an automatic refund guarantee. Plan names are Free and Premium. Billing prices, quotas and availability come from approved configuration. No invented plan prices or marketing promises.

Support the approved multi-seller shopping model. Before payment implementation, settle whether one checkout creates grouped seller orders or another explicit structure and how fulfillment, fees, payments, refunds and seller liability relate. A one-seller test fixture does not define the final product model.

A Product contains listing content; a ProductVariant is the sellable SKU. A no-option product has one default variant. Quantity minimums/increments and units are explicit. Store exact monetary/quantity values and purchased snapshots; never trust client prices or totals. Separate commercial acceptance, payment and fulfillment states. Configure actual pickup/delivery offers; a screenshot does not authorize same-day delivery claims.

Build a hierarchical food taxonomy with stable identifiers, Bulgarian/English labels, ordering, category attributes and search synonyms. Task 2 records the approved categories and quantity/attribute rules in this document before catalog publication acceptance. Example families are fruit/vegetables, dairy/eggs, meat/fish, bakery, pantry and beverages; they are illustrative, not an approved production seed list. The food model exists from the beginning; reference comparison data does not require a temporary fashion schema.

Food facts can include ingredients/allergens, origin, unit/package, storage and applicable expiry/lot information. Required fields depend on the approved category/market policy. Seller-supplied evidence determines certification/organic/origin claims; AI and photographs do not establish them. Appropriate food, consumer, privacy and tax review precedes release; this document is not legal approval.

### Task 2 catalog proposal (DEC-003, 2026-09-08, not approved)

The following is a concrete initial taxonomy for review, not published production data. IDs remain stable when display labels change. Leaf IDs use the parent prefix plus the suffix shown below; assign products to a leaf and derive ancestor filters. Store synonyms separately by locale; transliteration improves retrieval but must not rewrite the seller's original identity or claim a translated certification.

| Parent ID | Bulgarian / English | Proposed leaf suffix: Bulgarian / English |
| --- | --- | --- |
| produce | Плодове и зеленчуци / Fruit and vegetables | fruit: Плодове / Fruit; vegetables: Зеленчуци / Vegetables; herbs: Пресни подправки / Fresh herbs; mushrooms: Гъби / Mushrooms |
| dairy-eggs | Млечни продукти и яйца / Dairy and eggs | milk: Мляко / Milk; yogurt: Кисело мляко / Yogurt; cheese: Сирене и кашкавал / Cheese; butter: Масло и сметана / Butter and cream; eggs: Яйца / Eggs |
| meat | Месо / Meat | poultry: Птиче месо / Poultry; pork: Свинско / Pork; beef: Говеждо и телешко / Beef and veal; lamb: Агнешко / Lamb; prepared: Месни продукти / Prepared meats |
| seafood | Риба и морски дарове / Fish and seafood | fish: Риба / Fish; shellfish: Морски дарове / Shellfish |
| bakery | Хляб и печива / Bread and bakery | bread: Хляб / Bread; pastries: Закуски и печива / Pastries; sweets: Сладки и десерти / Sweets and desserts |
| pantry | Основни храни / Pantry | grains: Зърнени и бобови / Grains and legumes; flour-pasta: Брашно и паста / Flour and pasta; oils: Масла и оцет / Oils and vinegar; preserves: Консерви и туршии / Preserves and pickles; honey-jam: Мед и сладка / Honey and jam; nuts-spices: Ядки, семена и подправки / Nuts, seeds and spices |
| beverages | Напитки / Beverages | water: Вода / Water; juice: Сокове / Juices; tea-coffee: Чай и кафе / Tea and coffee; other: Други безалкохолни / Other non-alcoholic drinks |
| prepared-food | Готова храна / Prepared food | meals: Ястия / Meals; salads: Салати / Salads; soups: Супи / Soups |

Alcohol, supplements, live animals and non-food products are outside this proposed initial seed list; adding them needs an explicit category/publication policy. This is a seed proposal, not a silent reduction of the full product roadmap.

Common structured fields: producer/seller identity, origin, sold unit, net content/package count, ingredients/allergen declaration with applicability, storage instructions and fulfillment eligibility. Produce adds variety/grade where supplied; dairy adds milk source/fat content where applicable; meat/seafood adds species/cut and fresh/frozen state; bakery/prepared food adds ingredients, storage and applicable preparation/use-by details; pantry/drinks add composition and net content. Lot/expiry belong to applicable inventory lots rather than one misleading universal product date. Search facets use validated typed attributes, not unstructured marketing text. Certification claims require the merchant's evidence and review status. The final market/category compliance checklist is DEC-004 work; these proposed fields alone do not certify legal compliance.

| Sale mode | Stored quantity and proposed defaults | Example and validation |
| --- | --- | --- |
| Piece / брой | Integer; minimum 1, increment 1 | 3 apples sold per piece; never accept 1.5 pieces |
| Package / опаковка | Integer; minimum 1, increment 1; explicit count/net content | 2 packages of 6 eggs or 2 jars of 500 g; price is per package, not per egg/kg |
| Weight / kg | Exact decimal with maximum 3 fractional digits; proposed minimum/increment 0.100 kg | 0.300 kg at EUR 8.00/kg produces EUR 2.40; represent as 300 integer grams for arithmetic |
| Volume / l | Exact decimal with maximum 3 fractional digits; proposed minimum/increment 0.100 l | 0.500 l at EUR 4.00/l produces EUR 2.00; represent as 500 integer millilitres for arithmetic |

Merchants may configure positive minimums/increments on the permitted precision grid. Require minimum to be a multiple of increment; a requested quantity must be at least the minimum and an exact multiple of increment. The server enforces the same rule for publication, cart, quote and inventory. Unit price uses integer cents per declared sale unit; calculate a quantity line with exact rational arithmetic and round once to cents, half up. Keep the exact quantity, unit price and charged line amount in the purchase snapshot.

Proposed first weighted-sale behavior is exact ordered weight/volume, fulfilled as quoted. Fixed 500 g packs use integer package quantity. Actual-weight-after-picking adjustments, substitutions or surcharges require a separately approved buyer-consent/payment flow; they are not silently applied to a completed quote.

Proposed publication gates: authorized active business; reviewed BG/EN title and required buyer facts; leaf category; at least one valid variant with currency/positive price/unit/minimum/increment; available media with publication rights; applicable food facts; explicit fulfillment offer and stock policy. Translations stay draft until reviewed. An unknown allergen field is not equivalent to allergen-free; absent facts cannot become AI-generated claims. Missing stock may yield a visible unavailable listing if the merchant chooses, but never an orderable offer. Publication states are draft -> in review (where required) -> published, with rejected/changes-required, suspended and archived states; only authorized actors may transition them. Product publication and business verification remain separate.

### Task 2 commerce proposal (DEC-002, 2026-09-08, not approved)

**Preferred interpretation for review:** one checkout creates a parent purchase and one seller order per business, with one buyer payment and separate fulfillment per seller. The headline's EUR 0.50 applies once to that parent purchase. Applying EUR 0.50 to each seller order is a different policy and is not assumed. Display seller groups, each fulfillment charge and the single fee before confirmation.

Let `B` be the sum of merchandise line amounts after seller-funded discounts, in EUR cents. Allocate an order discount to eligible lines proportionally using largest remainder, capped by each line's value; reject a discount above the eligible base. Proposed fee: `F = floor((5 * B + 50) / 100) + 50` for a nonempty positive-value purchase. This is 5% rounded half up to a cent, plus 50 cents. Fulfillment is excluded from `B`; add its configured charges separately. Zero-value checkouts are not supported in this proposal. Displayed merchandise prices are the buyer's payable amounts; tax breakdown and invoicing still require DEC-004 configuration. No additional processor surcharge is silently added.

Allocate the entire fee `F` to seller orders in proportion to their discounted merchandise totals, using floor shares then distributing remaining cents by largest fractional remainder (ties by stable seller-order key). Repeat within each seller order across its lines, using stable line keys for ties. Persist the original allocations; their sum must equal the charged fee. Seller commission remains zero. Proposed settlement entitlement is seller merchandise plus seller-provided fulfillment, before that seller's refunds; the platform retains the buyer fee and bears provider processing costs in this proposal. Partner-provided fulfillment has a separately configured payee; it cannot be paid to a seller by assumption. Reserve, settlement timing, dispute liability and provider charges must be approved before live activation.

Proposed cancellation/refund behavior: before payment, cancel the unpaid operation and release reservations idempotently. After payment, full cancellation of an unfulfilled seller order returns its merchandise, allocated fee and charged fulfillment. Partial item refunds return the original refundable merchandise plus its proportional original fee; delivery remains charged when delivery still occurs. A full failed fulfillment returns its charged delivery; post-delivery quality/return disputes follow an approved decision with explicit refundable amounts and reasons. This is a commercial proposal, not an assertion of statutory return eligibility.

For line fee allocation `A`, original merchandise `L > 0` and cumulative refunded merchandise `R`, cumulative fee refund is `roundHalfUp(A * R / L)`, capped at `A`. Send only the difference from the previously refunded amount. Fully refunded lines return their entire allocated fee, including the allocated fixed portion; never recalculate a new fee on the remaining cart. The final refund returns exactly the original remaining refundable amount. Concurrent/repeated requests share one durable refund operation; a failed provider refund remains pending/failed, not completed. Restock only after the applicable physical/cancellation disposition, not merely because money was refunded.

| Example (EUR) | Merchandise / fulfillment | Fee | Buyer total or refund |
| --- | --- | --- | --- |
| Single seller | 19.99 / 3.00 | 1.50 | Charge 24.49 |
| Seller discount | 25.00 less 5.00 / 3.00 | 1.50 | Charge 24.50 |
| Rounding boundary (arithmetic only) | 0.10 / 0.00 | 0.51 | 0.61; provider minimum-charge eligibility still applies |
| Two sellers A/B | A 20.00 + 3.00 delivery; B 10.00 + free pickup | 2.00; A allocation 1.33, B 0.67 | Charge 35.00; seller entitlements 23.00 and 10.00 before provider/settlement adjustments |
| A partial refund, one original line | Refund 10.00 of A's 20.00; delivery still occurs | Refund 0.67 | Refund 10.67 |
| A remainder cancelled before fulfillment | Remaining 10.00 plus A delivery 3.00 | Remaining 0.66 | Further refund 13.66; A cumulative refund 24.33 |
| B fully cancelled | B 10.00; pickup charge 0.00 | Refund 0.67 | Refund 10.67; combined full A+B refunds total 35.00 |

The two A rows illustrate sequential refunds of the same original line, with remaining fulfillment subsequently cancelled; they do not promise automatic delivery refunds after delivery. All amounts are policy examples, not executed payments or approved merchant settlements.

Proposed initial sandbox methods: provider-managed cards with authentication/challenge and decline recovery; eligible Apple Pay/Google Pay only after device/account/domain verification. Cash-on-delivery, delayed bank methods and split buyer tenders need explicit collection/reconciliation decisions before being enabled. Keep personal/business checkout context, one currency and a confirmed fulfillment offer for every seller. If any seller fails quote validation before payment, return an actionable error for a new confirmed quote rather than silently dropping that seller.

Technical candidate: Stripe Connect separate charges/transfers supports a platform charge with transfers to multiple connected accounts. Account eligibility, region/capability checks and the platform's actual financial responsibilities require verified sandbox/provider setup; this proposal does not establish merchant-of-record or tax status. See [Stripe's separate charges and transfers documentation](https://docs.stripe.com/connect/separate-charges-and-transfers).

Use one durable internal checkout/payment operation across web/native and interrupted returns, provider idempotency and authenticated server callbacks. Stripe documents reuse of an existing PaymentIntent for an interrupted purchase, idempotency keys and server webhook status tracking; its current docs recommend evaluating Checkout Sessions for most integrations. Choose the compatible web/native integration in Task 5 without duplicating the commerce engine. A client success page is not payment proof. See [Stripe payment lifecycle guidance](https://docs.stripe.com/payments/payment-intents).

Sandbox acceptance must cover the EUR examples above, exact quantities, last-stock competition, successful/declined/challenged payment, interrupted return, duplicate/out-of-order callbacks, seller cancellation, partial/full refunds, failed refund retry, transfers/reversals and reconciliation after provider interruption. Use disposable PostgreSQL and verified sandbox accounts with synthetic buyers/sellers. No provider resources or SDKs are provisioned by this documentation batch.

## 6. Partner operations

These are explicit product workstreams, not instructions to search another repository for hidden features. Task 2 settles their business rules and activation scope with the owner. Work on the core marketplace need not wait for optional operational configuration.

| ID | Build | Required observable behavior |
| --- | --- | --- |
| OPS-001 | Supplier/distributor relationships | Authorized businesses can establish and review partner relationships, view the information actually shared with them and manage permitted sourcing/supply activity. Linking businesses never transfers catalog ownership or grants unrestricted access. |
| OPS-002 | Delivery/pickup coordination | Configure partner pickup points and scheduled fulfillment runs, applicable locations/windows/capacity, dispatch assignments and exceptions. A buyer is offered only eligible configured fulfillment. |
| OPS-003 | Assigned driver workflow | An assigned operator sees the minimum necessary job/contact details, records allowed pickup/handoff/delivery/exception events and cannot access unrelated orders or finances. Events feed the canonical order timeline. |

No invented nationwide logistics service, routing optimizer or autonomous fleet management. Product planning records the intended workflows; a limited release must label any deferred work explicitly rather than call the full platform complete.

Task 2 activation proposal, awaiting owner review: core catalog uses each merchant's configured pickup/delivery offers. Task 11 introduces explicitly accepted business-to-business relationships, pickup-point/run capacity and assigned-driver work. Relationship states: invited, accepted, suspended, ended; each agreement names shared resources and allowed actions. Dispatch states: unassigned, assigned, accepted, collected, delivered or exception, with reassignment history. Driver updates cannot mark payment paid or issue refunds. Capacity is reserved/released against the canonical fulfillment booking; repeated handoff events are idempotent. Partner payee/fee responsibility, service area, schedules, capacity unit and exception ownership must be configured per activated service. No partner account or regional service is activated by the proposal.

## 7. Native and quality

| ID | Build | Required observable behavior |
| --- | --- | --- |
| NAT-001 | Native buyer product | iOS/Android discovery, product, cart, checkout, purchases, account and support use the supported API; navigation, keyboard, safe areas and accessibility are verified per platform. |
| NAT-002 | Native lifecycle/recovery | Secure session persistence, cold/deep links, interrupted payment return, background/resume, unreliable network and truthful offline read/mutation states; no offline claim of successful payment. |
| NAT-003 | Native release | Verified installable builds/devices, configured identities/signing, permissions, privacy/account deletion and separately authorized store submission. Export or Expo Go alone is not a release build. |
| QUA-001 | Cross-cutting quality | BG/EN completeness, explicit global data boundaries, accessibility, SEO, measured performance, tenant-safe caching, observable failures, backups and recovery as defined in verification.md. |
