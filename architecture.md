# Architecture — Treido Global / general marketplace

## Shape

Keep the copied frontend. Connect its components through typed queries/commands to server-owned domain functions and database/provider adapters. Use the existing server package; create small feature modules as needed rather than a new universal framework. Names below describe intended records/interfaces, not files that already exist.

Start with T01’s minimal schema and T02’s slice. The complete entity list is coverage for subsequent features, not a demand to generate every table first.

## Entities and ownership

- User, SellerAccount(kind), Membership, Store: immutable seller kind and separate business authority.
- Listing, ListingRevision, ListingMedia, Allocation: a specific item with concurrent reservation/purchase protection.
- Conversation, Message, Offer: listing and participant bindings; immutable accepted terms.
- Order, Quote, PaymentAttempt, Shipment, ReturnCase, SettlementEntry: snapshot-bound financial and handover state.
- PlanVersion, Subscription, Entitlement, UsageCounter, Invitation: seller-bound access, deadline and exact quota usage.
- Save, Collection, Follow, SavedSearch, Review, ModerationDecision: authorized public/private views.

## States

- Draft -> published -> withdrawn; availability available -> reserved -> sold; moderation restricted is separate.
- Offer sent -> countered/accepted/rejected/withdrawn/expired; acceptance may reserve but never marks paid.
- Allocation active -> consumed/released/expired with one live allocation for a unique listing.

## Critical behavior

Unique-item allocation and seller publication quota checks must commit with the command they protect. Provider state and subscription expiry cannot grant resource ownership. Keep identity, plan and listing eligibility checks separate.

## Initial typed contracts

- PublishListing(actor, sellerId, draftId, version) -> listing or structured field/quota conflict.
- AcceptOffer(actor, offerId, version, requestId) -> reservation or sold/expired conflict.
- CheckoutListing(actor, listingId, quoteRevision, requestId) -> one bound order attempt.
- SellerEntitlements(actor, sellerId) -> current limits/usage/actions/reason codes, not just a paid boolean.

Queries return minimal authorized view models. Commands validate the actor, resource, expected version and retry identity. Implement these interfaces in the copied app’s actual owners; do not build an extra internal HTTP layer for calls that can stay within the server.

## From fixture to real data

Fixtures and connected adapters use the same view model. A real-service error never silently substitutes sample data. Keep draft/selection state in the browser where useful; permissions, stock/capacity, purchases and paid access remain server-owned. Public publication/withdrawal updates all affected reads; private caches are actor-scoped.

Commit domain changes and required effect intent in short transactions. Call payment/mail/media providers outside locks; retries reuse the same operation. Add a durable runner when delayed work is needed. Validate media ownership and authorize private delivery. Test the relevant cross-user, retry and race cases with isolated development data.
