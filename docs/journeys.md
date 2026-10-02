# User journeys and state contracts

September 30, 2026. Target behaviour for the complete web release requested by the owner. [Features](features.md) maps journeys to requirements/tasks; [marketplace](marketplace.md) and [billing](../billing.md) own the domain rules. Keep existing Shop geometry, navigation, sheets and gallery behaviour while replacing their inputs and commands.

Visual implementation follows [UI patterns](ui-patterns.md): BUY patterns for shopping, STU patterns for merchant work, and existing direct Sell/auth form styling for those entries. [UI verification](ui-verification.md) supplies matched-state and failure acceptance. Studio global Search, Sell Helper and buyer Minis remain distinct flows; approved main-site/store exits preserve language, current store and Back context without pretending that a local storefront is published.

## J01 — Browse Personal or Businesses

A guest lands on the mixed feed. The existing compact current-scope pill opens the All sellers / Personal / Businesses selection sheet; All is the mixed default, not an additional reset row. Selecting Businesses includes listings owned by business sellers; selecting Personal includes personal sellers. Both support new, used and refurbished goods according to category rules. No login is needed to browse.

The URL owns `seller=all|personal|business`; missing/invalid means all. Selection persists through search, category, detail, seller pages and assistant results, preserving query/price/condition/location/sort and resetting only the cursor. Back restores the previous state and scroll. A storefront keeps its named seller, so an incompatible browse filter is explained or reset explicitly rather than changing whose store is shown. Shared links reproduce scope; a remembered preference cannot override a shared URL.

Cards and seller headers show seller kind, actual condition, supported delivery and justified claims independently. Search with no business stock returns an honest empty state with a visible option to browse all; it never inserts personal listings into business-only results.

## J02 — Sign up and choose what to do

[Seller workspace](seller-workspace.md) owns the `/sell` continuation, `/app` onboarding and direct-to-editor route contract. These are implementation targets, not an already connected signup flow.

Create one human account through supported Clerk flows using the current account UI. Ask **What would you like to do? Buy / Sell my items / Sell as a business** as skippable intent, not a permanent legal identity or a forced subscription. Buying stays available to everyone. Preserve an interrupted save/message/sell intent through verified sign-in and return the user to its original screen.

Choosing Sell my items starts or resumes the human's single personal seller. Choosing Sell as a business creates or joins a separate business seller; it does not convert the human's existing personal listings. Ask business details when needed for business publication/payouts rather than collecting an entire business dossier from every buyer. Existing members can select a business they are authorised to operate. Do not add an unsolicited hosted authentication redesign.

Verification, trader declaration and payout onboarding have separate status and explanations. Recover duplicate signup, expired session, cancelled verification and provider unavailability without losing the intended action. A user can return to selling later from the existing account/navigation affordance.

## J03 — Personal seller publishes an item

Sell opens an existing draft or a new durable draft under the personal seller. Choose leaf category, upload/reorder photos, enter title/condition/defects/attributes, price and supported delivery/pickup. Display saved/pending/offline status. A local fallback buffer recovers unacknowledged input; the server draft/revision remains authoritative and is accessible on another device.

Show a preview using the existing product-detail composition. On Publish, the server validates ownership, current membership, category policy, ready media, revision and quota atomically. Success provides the canonical listing URL. A failed upload or concurrent last-slot conflict preserves the draft and explains the next action. Never charge a seller merely for starting a draft.

Seller can edit, pause, withdraw, duplicate a draft or mark a handover sale. Editing sold/allocated items cannot rewrite accepted terms or evade moderation. A reported off-platform sale is labelled seller-reported; it creates no verified order/review.

## J04 — Business starts and operates a store

Use the same private [seller workspace](seller-workspace.md) as personal sellers, with business capabilities added under an authorised operating seller. The initial shell is T04d; T10b extends it with store/team/inbox and the separately qualified order tools.

The workspace opens a resumable setup checklist until the relevant tasks are complete, then prioritizes drafts, messages, fulfilment and exceptions. Business details, first product, delivery/returns and payment setup can be resumed independently. Personal Sell continues directly to the editor. Visiting or prefetching a route creates no seller/draft; explicit setup/first-save commands do that idempotently. Readiness for draft, publication and on-platform payment is recomputed from their separate requirements.

Create business public identity (name, handle, logo/cover, description, locality) and separate private legal/contact/declaration fields. Use the shared Shop seller shell for storefront, category pills, information and reviews. Business Free provides a usable store and selling flow; the Pro upgrade is optional.

Owner invites teammates by capability. Invitations have expiring, single-use tokens; accepting requires verified intended identity and current seat capacity. Owner/manager/member permissions are visible in the workspace. A removed member immediately loses new reads/commands; accepted orders and support remain available to remaining authorised operators. Protect the last owner.

Manage listing/stock/variant drafts, inbox, orders, fulfilment, analytics, imports and billing under an explicit operating seller. Switching that account never changes the public browse filter. A staff member can operate several businesses without leaking one seller's customers, files or subscriptions into another.

## J05 — Import an existing business catalogue

Authorised staff uploads a bounded CSV/template. Map columns and preview valid/invalid rows, category, condition, price/currency, stock, variants and seller-owned images. External image ingestion permits reviewed public HTTPS destinations with SSRF protection and rights confirmation; arbitrary private URLs are rejected.

Import is a durable resumable job with stable row identity and hash. Retrying does not duplicate products or charge twice. Invalid rows remain repairable; valid rows become drafts. Publication is explicit and uses ordinary policy/media/quota validation. A bulk import never bypasses account limits or moderation. Export includes only that seller's authorised commercial fields.

## J06 — Find, inspect, save and follow

Search by Bulgarian/English name, transliteration, brand/model, category, condition, seller kind, locality and price. Choose relevant/newest/price sorting and bounded pagination. Open a listing, inspect real photos, defects, price/variant/stock and seller, then return to the same result position. Public pages render useful shareable content and real metadata without downloading the entire catalogue.

Saving/following requires identity, persists across devices, and has reversible pending/error states. Collections start private. Saved unavailable items retain an honest sold/removed state where safe; moderation/private records do not leak through thumbnails. Saved-search alerts use explicit consent and recheck eligibility/scope before delivery.

## J07 — Message, offer and arrange handover

Message starts or reuses a thread for buyer, seller and listing. Public messages contain the exact listing context; private attachments stay participant-authorised. Persist before claiming delivery, deduplicate retries, record unread cursors, and support reconnect. Block/report functions have durable receipts and operator handling.

Make an offer records amount/currency, listing revision, expiration and permitted parties. Seller can accept/reject/counter; buyer can accept a counter/withdraw. An accepted offer binds terms and acquires allocation through the same inventory authority as Buy Now. A second buyer cannot acquire a unique item through a different route. Expiration is based on server time. Messaging is usable without AI.

Contact/pickup listings disclose that payment is arranged by the participants when on-platform checkout is not supported for that item. The platform records this as a contact/handover mode rather than fabricating payment protection.

## J08 — Buy and pay

Cart visually groups lines by seller. A checkout is one seller and currency; separate seller groups create separate orders/charges with explicit totals. Unique listings have quantity one; stocked business variants have selected SKU and bounded quantity. No reservation occurs merely because a line is in a cart.

Server quote includes actual item/offer amounts, applicable shipping and fees, tax/disclosure policy, recipient/fulfilment choice and immutable terms. Review happens before commitment. An eligible seller has completed required payout onboarding. Allocation and durable payment attempt exist before the external Stripe request; uncertain requests resume the same attempt.

After redirect, display Pending until authoritative confirmation. Confirmed inventory/order changes appear across search, saved items, seller workspace and buyer history. Failures preserve useful input and provide recovery; duplicate clicks/events cannot create a second sale or charge. Unsupported shipping or payment is explained before collecting payment details.

## J09 — Fulfil, cancel, return and resolve

Seller receives only confirmed orders and relevant buyer fulfilment details. Allowed transitions cover processing, shipped/tracked or pickup-ready, completed, cancelled and exception. Carrier updates deduplicate and cannot undo a later state. Buyer/seller see consistent status and a reachable support path.

Cancellation eligibility and business/private sale rights derive from the accepted policy, not a generic badge. Record returns/cases, evidence, decisions and partial/full refunds; cumulative refunds cannot exceed the refundable total. Unknown provider outcomes reconcile. A refunded unique item is not automatically relisted. Reviews require an eligible completed purchase. Financial displays follow actual charge/transfer/payout facts: the destination-charge baseline does not hold the seller transfer until delivery. [Billing](../billing.md) owns recovery and any separately qualified delayed-transfer design.

## J10 — Plans, boosts and invoices

Show current seller plan, usage and exact prospective price/renewal/cancellation terms. Subscription purchase is separate from item purchases and promotion purchases. Upgrade unlocks only verified entitlements; cancellation/downgrade preserves existing obligations and restricts new excess activity rather than deleting data.

Boost starts from an eligible owned listing, previews placement/duration/scope/price and explains Sponsored labelling. Purchase grants the exact campaign once after confirmed payment. Sales, expiry or moderation stop serving; refunds/credits follow the documented reason-specific policy. Paid status never buys verification or exemption from item rules.

## J11 — Useful assistants

Minis becomes a Shopping tools hub using the existing card/sheet/input/answer patterns. Choose Find for me, Deal Finder, Compare, Photo Match, Gift Finder, Compatibility or Sell Helper. User can inspect/edit interpreted constraints and sees listing-linked evidence. Global browse scope remains a hard filter. Voice input is explicit and editable; microphone permission is requested when invoked.

Assistants read real bounded data and disclose unknown shipping/condition/compatibility. Sending a message, saving, creating a draft or accepting terms uses an explicit reviewable action; no model can publish, buy, refund or change seller authority on its own. Provider failure returns deterministic search or retained draft input. [Assistants](assistants.md) owns tools, budgets and evaluations.

## J12 — Trust, account and support

Report reaches an operator queue with a receipt, category and evidence. Operators review/remove/restore with restricted capability, reason and appeal path; removals affect detail/search/AI/promotion caches. Seller and reporter private identities are not public. Account security/preferences, notification consent, export and closure remain reachable without a paid plan. Retention and open obligations are resolved under the reviewed policy.

## Shared states and acceptance

Every journey covers empty, pending, retry, unavailable, invalid input, expired session and denied access. Use the established sheets/focus/Back behaviour and BG/EN copy, including long labels at 320px and 200% text. Critical journey verification includes two humans/two sellers, removed membership, foreign IDs, stale revision, duplicate request, concurrency and provider interruption. Screenshot matching and interaction testing are both required for rendered changes. A new spec or reference screenshot does not establish an implemented journey.
