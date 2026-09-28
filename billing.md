# Billing — Treido Global / general marketplace

Read for subscriptions, checkout, entitlements or financial tasks. **Not required for copying the clone or ordinary UI/catalog work.**

## Product policy

Seller Free/Pro subscriptions are separate from item purchases. Plans belong to a personal or business seller account, not the human login. Initial subscription direction is monthly Pro. Live prices, limits and transaction fees must come from this product’s confirmed catalog; the old EUR 7.99/14.99 values are test fixtures only, not public offers.

## Plans and implementation values

Retained development catalog: personal Free/Pro active-listing limits 30/150, drafts 100/200, seats 1/1; business Free/Pro active listings 100/500, drafts 200/1000, seats including owner 3/10. Analytics history 30/365 days and analytics export off/on in either seller kind. Pending valid invitations reserve a seat (source proposes 7-day expiry). Downgrade does not unpublish items or evict current members; only new over-limit actions are restricted. Buyer AI is separate. Annual plans, trials and boosts are not initial benefits.

## Connect and verify

First inspect the intended Stripe account/environment and reuse matching Product/Price bindings; do not create duplicates or copy credentials from a donor. Keep account configuration separate from product policy. Unknown live terms block live charging, not implementation with explicit test configuration.

Server quotes snapshot owner, purpose, currency, amount, fees and terms. Persist the attempt before provider calls; retries reuse its identity. Verify signed webhook context, deduplicate effects and reconcile out-of-order/uncertain results. Redirect URLs do not grant payment or access. Cancellation/refund/expiry follow this product’s policy, without deleting unrelated data.

## Product-specific checks

- Final-slot publish and invitation races must enforce the versioned cap.
- Period expiry keeps existing messages/orders/support and listings available under documented downgrade rules.
- Changing seller invalidates an old plan quote and never reuses another business's Stripe Customer.
- Subscription refund/cancel never silently cancels an item purchase and vice versa.

Also test wrong actor/account/mode/signature, changed amounts, duplicate events and interrupted return. [PRD open decisions](prd.md#open-decisions) lists unresolved commercial choices. Historical values in sources.md are context, not a live catalog.
