# Billing, subscriptions and item commerce

Commercial proposals date from September 30, 2026; payment architecture was clarified October 1. This document owns seller plans, revenue proposals, Stripe lifecycle, checkout, refunds and settlement. The owner includes checkout, plans and boosts in the full first web target. Prices below are concrete recommended v1 terms for implementation/sandbox review, not already approved live offers or a charge instruction. [Tasks](tasks.md) alone records integration/activation.

## Separate purposes

A seller subscription buys versioned seller capabilities. An item purchase buys goods under an immutable quoted sale contract. A promotion buys a specific visibility delivery contract. All three have separate purpose/mappings, attempts, records, refund rules and metrics. Seller account selection must never reuse another business's subscription customer. Pro does not grant resource ownership, verification or moderation immunity.

## Recommended v1 plans and entitlements

| Plan ID | Proposed monthly price | Who and core value |
|---|---|---|
| `personal_free` | EUR 0 | usable occasional selling, discovery, messaging and support |
| `personal_pro` | EUR 7.99 | higher listing/draft limits, longer commercial analytics and export |
| `business_free` | EUR 0 | actual business storefront, basic stock/listing tools, team and inbox/orders |
| `business_pro` | EUR 24.99 | larger catalogue/team, larger imports, longer analytics and commercial exports |

The old EUR 7.99/14.99 pair was historical sandbox evidence. EUR 24.99 is the new recommended Business Pro proposal, not an existing Stripe Price. Currency is explicit throughout; legacy BGN examples are not silently reinterpreted as euros. Bulgaria's euro transition is documented in [sources](sources.md#september-30-product-research); actual tax/invoice/display treatment still follows the approved entity/country configuration.

| Capability | Personal Free / Pro | Business Free / Pro |
|---|---|---|
| Active listings | 30 / 150 | 100 / 500 |
| Drafts | 100 / 200 | 200 / 1000 |
| Seats, including owner | 1 / 1 | 3 / 10 |
| Analytics history | 30 / 365 days | 30 / 365 days |
| Commercial analytics export | off / on | off / on |
| CSV import per job | off / off | 25 / 1000 rows |
| Listing inventory mode | unique / unique | unique or stock / unique or stock |
| Variants per stocked listing | not applicable | 25 / 50 valid SKU combinations |
| Paid boosts | available / available | available / available |

Retain the four plan IDs and version their prices/limits. Monthly billing is the v1 direction; annual/trials/higher tiers remain named expansion. Basic published listings, inquiries, reporting, order/support access and legal personal-data export remain usable without Pro. Paid boosts are included in the full web release through [promotions](docs/promotions.md), with independent purchase and no automatic bundled credit. Do not import Foods' fees.

Show exact current usage and upgrade value before commitment. Free stock/import tools make a business trial useful; larger limits justify Pro. Do not label free listings invisible or promise Pro sales. Publishing uses current seller-plan entitlement; browser switches/old subscription events cannot refresh limits.

A pending valid invitation reserves capacity; seven-day expiry is a retained development proposal. Define active usage explicitly: published available/reserved listings count, including held moderation states until withdrawn; drafts and seats have separate counters. Compute/check/update limits in the transaction that publishes or reserves a seat. Counters must be reconcilable against underlying records.

Downgrade/expiry preserves existing listings, members, conversations, orders and support obligations. Restrict new over-limit actions instead of silently deleting or unpublishing resources. Legal personal-data export is never paywalled. Enforce access against database time, verified subscription interval and revocation—not just a provider status string or a scheduled job that may be late.

## Item commerce and grouped cart

One seller and currency per order, one or more lines. Unique listings have quantity one; business stocked SKUs have validated quantity/option combinations and atomic inventory allocation. A cart groups separate seller checkouts and is not reservation. Combined multi-seller payment and auctions require their own expansion contract. Preserve clone cart geometry while connecting quantities/options to real inventory; its max-99 state is not authority.

A server-generated, expiring quote snapshots listing/revision, buyer/seller, item amount, currency, shipping, fees, tax policy and terms. Revalidate eligibility and obtain a unique-item allocation before initiating payment. An accepted offer binds its terms; price changes cannot mutate an existing agreement.

All quote lines allocate atomically or none, using the same allocation service as offers. Expiring development quote/hold defaults start at 10 minutes and are reconciled to the selected payment-method/provider session behaviour during T12; a fixed timer must not release inventory while an eligible payment remains pending. Supported pickup/contact modes disclose whether payment is on platform. Carrier/collection readiness and complete known totals are checked before payment.

## Revenue and promotion catalogue proposals

Recommended item commission: **3% of item subtotal plus EUR 0.30 per paid order**, charged to the seller, with no separate mandatory buyer platform surcharge in v1. Shipping/tax treatment remains explicit and excluded from the commission base unless a reviewed policy says otherwise. This is a planning proposal to test against actual processor/Connect/refund/dispute/support economics; it is not a forecast of profitability. Destination-charge processor fees are accounted according to the selected account contract and ledger, never hidden in a fake seller-proceeds field.

Illustration before shipping/tax/provider treatment: EUR 100.00 item subtotal → EUR 3.30 proposed Treido fee → EUR 96.70 item proceeds before other disclosed seller costs. Calculate percentages in integer minor units with a specified rounding rule (nearest minor unit, ties upwards for positive fees). Quote/refund records freeze the applicable fee version; existing orders cannot adopt tomorrow's rate.

| Promotion product | Proposed EUR price | Delivery |
|---|---|---|
| `bump_once_v1` | 0.99 | one eligible bump |
| `category_spotlight_7d_v1` | 3.99 | seven-day matching sponsored rotation |
| `home_spotlight_7d_v1` | 7.99 | seven-day eligible discovery rotation |

Promotion prices require capacity/terms/economic review before sale; no promised sales/views. [Promotions](docs/promotions.md) owns delivery, ranking and compensation. Do not invent auction/advertising wallets or auto-renewal spend. Platform revenue distinguishes commission, subscriptions and promotions from GMV.

## Stripe subscription lifecycle

Map one intended seller/environment customer and versioned server-owned Product/Price. Checkout requires current billing capability and a legal catalogue selection; browser-submitted arbitrary price IDs are rejected. Subscribe → pending → verified paid interval/entitlement; support invoice, renewal, payment failure, portal, cancellation at interval end, explicit plan change and downgrade. Proration/upgrade timing is shown before confirmation and tested against the intended account configuration.

Verified provider state and paid interval determine service; signed duplicate/out-of-order events deduplicate and cannot revive a revoked grant. A configured dunning/grace policy states exact access/time; preserving orders/messages does not mean continuing unlimited paid entitlement. Cancellation/refund of a seller subscription has no automatic effect on item orders or promotion purchases. [Stripe subscription guidance](https://docs.stripe.com/billing/subscriptions/overview) is the integration reference; actual account mappings are separate evidence.

Persist an attempt and stable idempotency key before the provider call. External calls occur outside database locks. An uncertain response remains `reconciling`; do not create a fresh payment merely because the request timed out. A successful browser redirect grants nothing.

## Provider integration

Use verified, signed events with account/environment/purpose correlation and durable deduplication. Confirm amount, currency, seller and order/attempt, then transition atomically. Process out-of-order events using authoritative provider state and permitted transitions, not arrival order. Keep a recovery path when acknowledgement or processing fails.

Stripe Billing handles seller subscriptions; Checkout/payment flows handle each intended purpose; Connect handles seller onboarding/payment settlement. Recommended single-seller implementation baseline is destination charges where eligible, subject to actual entity, country, seller, dispute/refund and settlement policy. Resolve `on_behalf_of`/merchant-of-record and liability configuration through the intended Stripe account before activation; the software plan cannot decide legal status. If eligibility requires another charge type, record the bounded change and keep the same order/allocation contracts. Do not promise escrow or buyer protection merely because an API exists. [Stripe charge types](https://docs.stripe.com/connect/charges) owns provider semantics.

Destination charges transfer the seller's share to its connected Stripe balance as part of the charge. A subsequent bank payout is a different movement. This baseline therefore does **not** implement a Treido-held transfer until delivery; a `releaseSettlement` function cannot delay a transfer already made by Stripe. If the product requires delayed transfers, T12a must choose and qualify separate charges/transfers or another supported design before implementing that promise. Account/country eligibility and the commercial policy, not a UI label, decide the funds flow.

Destination-charge fees, refunds and disputes affect the platform balance under Stripe's documented model. Refund execution must deliberately handle application-fee refunds and transfer reversals, including insufficient connected balance, partial amounts and retries. Preserve the append-only ledger and reconcile actual charge, transfer, reversal and payout facts. These are engineering requirements, not approval of a funds-holding or legal arrangement.

Use [Stripe-hosted Connect onboarding](https://docs.stripe.com/connect/hosted-onboarding) for the first seller payment setup. A current `billing.manage`/payment-setup capability and supported recent authentication gate account-link creation; links remain short-lived and stay inside the authenticated flow. An expired link can be refreshed only after reauthorization. Return to the same seller workspace, fetch current requirements/capabilities, and show complete/action-required/unavailable honestly. Do not store bank or identity-document details in Treido when Stripe collects them. Optional embedded onboarding is a later scoped UX change, not a second onboarding authority.

Maintain separate state for declaration readiness, payment acceptance, payout eligibility and seller subscription. `details_submitted` or returning from onboarding is insufficient for payment eligibility. Require the exact current capabilities and requirements applicable to the qualified charge configuration. A seller can prepare drafts before payments are ready; supported contact-only listings explicitly avoid an on-platform paid claim.

Keep payment, order, fulfillment and settlement status separate. Provider-collected card details/tokens replace simulated cards; never store full card numbers or security codes. Refund totals are bounded atomically; simultaneous partial refunds cannot exceed the refundable balance. Settlement postings are append-only with reversals and reconcile per currency/provider identity.

## Failure cases that must pass before release

Wrong actor/seller/environment/signature; changed amount/currency; duplicate and delayed webhook; double click; two buyers; reservation expiry racing payment; late payment after another buyer acquires the item; duplicate subscription creation; invoice replay; final quota slot; concurrent invites; downgrade; partial/concurrent refunds; transfer failure and reconciliation after restore.

Late payment without an owned allocation blocks fulfillment and enters a reviewed compensation/refund path. If a destination transfer already happened, reconcile and reverse/refund as the qualified policy requires; do not claim that a webhook can retroactively block it. A refund does not automatically put a unique item back on sale. Subscription cancellation/refund never cancels an item order and vice versa.

## Live activation decisions

T12/T13/T26 inspect the intended existing accounts and record legal entity, supported seller countries/capabilities, test/live catalogue mappings, final prices/caps/fees/tax/invoices, handover/carrier policy, returns/refunds/disputes, settlement and support owner. Account availability is owner-declared; bindings and live offers are unverified by this documentation task. Reuse an authorised existing mapping only after purpose/ownership verification, never another app's credentials or an arbitrary duplicate Product. [Operations](docs/operations.md) and [launch](docs/launch.md) own release proof. This financial decision list does not block unrelated local implementation or require another whole-platform planning round.
