# Detailed engineering boundaries

> Detailed engineering requirements retained from the pre-Astra specification. Root architecture.md, verification.md and tasks.md own current routing, phases and evidence. Proposed structures and test targets are not claims of implementation.

Build a small monorepo with two clients and one authoritative commerce implementation. [product.md](../../product.md) defines behavior; [design.md](../../design.md) defines presentation; [techstack.md](../../techstack.md) defines installation; [verification.md](../../verification.md) defines proof. The architecture is selected, not a guarantee of perfect performance or correctness.

## 1. Structure and ownership

```text
apps/
  web/
    src/
      app/
        layout.tsx
        [locale]/
          (buyer)/                 discovery, shopping, account and purchases
          (merchant)/merchant/     full selling dashboard
          (platform)/admin/        privileged operations
        api/v1/                    supported native/client HTTP endpoints
        api/webhooks/              signed provider callbacks
        api/jobs/                  authorized work triggers
      features/
        catalog/ cart/ checkout/ orders/ inventory/
        identity/ conversations/ notifications/ finance/
      components/ui/               selected web primitives
      lib/                         provider clients, env and small utilities
    prisma/                        new schema and its reviewed migrations
    tests/
  mobile/                          Expo Router buyer application
packages/
  contracts/                       client-safe inputs, DTOs and error schemas
  design-tokens/                   platform-neutral semantic values
  locales/                         messages actually consumed by both clients
```

Create modules when their task starts, not empty folders for the whole roadmap. Packages use explicit @treido/* exports and cannot depend on applications. A database package is not needed by native. Extract a server package only if another actual server runtime becomes a consumer.

The browser platform has distinct buyer, merchant and admin layouts below a minimal root. Shopping must not import merchant chart/editor dependencies into its initial path. A URL prefix or layout is not an authorization boundary. The native app is an independent presentation client, not a second backend.

## 2. Request flow

Web Server Components and Server Actions call named, authorized feature functions directly. Native calls authenticated /api/v1 Route Handlers that invoke the same functions. Webhooks and workers invoke domain operations through verified entry points. Do not make server-rendered web pages call their own HTTP API unnecessarily. Do not expose Server Action internals as the native API.

A feature may have queries.server.ts, commands.server.ts, policy.ts, components and tests. These are useful conventions, not mandatory layers. Guard server-only modules; pure calculations have no framework dependency. Avoid generic repositories/controllers/interfaces around straightforward queries.

Client contracts are explicit projections, not generated ORM entity types. Shared code cannot import Prisma, credentials, next/headers, server-only or Node-only modules. React Native components and DOM components are separate implementations following the same design values and API meanings.

## 3. Identity and permissions

Clerk authenticates a person. The server resolves local identity, current business membership and resource permissions. Map external/local identities uniquely and handle disabled/deleted state. A business ID from a cookie, form or token is a requested context, not authority by itself.

Authorize every private read/write/export/subscription/file request in its owning function. Queries scope records by actor/business; mutations recheck current ownership and allowed state. Handle membership/seller-status changes racing consequential writes. Platform privileges are separately granted; a premium plan or seller role never grants administration.

Native uses provider-supported bearer authentication over HTTPS with signature/expiry and applicable issuer/audience validation. Browser cookie writes need same-origin/CSRF protection. CORS is not authentication. Logout, account change or workspace switching clears private caches/subscriptions; late responses cannot populate another account's state.

Identity callbacks use verified signatures, durable event identity and safe reconciliation. First-login provisioning and callbacks cannot create duplicate users or resurrect revoked membership. Audit consequential actions with actor, resource, action, time, result and correlation ID, without private message bodies or secrets.

## 4. New data model

Design the schema from product.md. Start in fresh isolated development PostgreSQL with synthetic users, businesses, products and orders. No import of another schema, table names, routes or identifiers is a prerequisite. The model must work independently.

Use real foreign keys, appropriate uniqueness/check constraints, indexes and explicit transaction boundaries. Catalog deletion must not cascade away purchased history. Apply forward migrations for this application's schema; do not rewrite already-applied migration history. Transferring real data from any existing system is a separately authorized project with explicit mapping and reconciliation, not a hidden gate for building Treido.

### Catalog, quantities and money

Product owns shared listing content; ProductVariant owns sellable options/SKU, unit/package, quantity rules and commercial identity. Every product has a default variant when it has no visible choices. Inventory/cart/order relationships must agree on product, variant and business ownership.

Store money in integer minor units with an explicit currency and safe bounds. Use exact decimal/scaled arithmetic for weighted quantities; serialize API quantities as validated decimal strings. Approved precision, increments, minimums and rounding are explicit policy and test cases, not binary floating-point comparisons.

Every quote/order enforces market/currency rules. Reject mixed-currency checkout initially. Locale, market, currency and time zone are separate values. Persist UTC event timestamps and explicit local fulfillment/business zones.

### Inventory

Define on-hand, reserved and available quantities without double subtraction. Reservations have durable identities, state, quantity, expiry and order/variant relationships. Successful consumption and cancellation/expiry release have distinct mutually valid transitions. Lots, expiry and locations apply where the product/workflow calls for them.

Prevent overselling using transactions and conditional updates/locks. Acquire related resources in a stable order where needed, with bounded retries for classified transaction conflicts. In-memory locks and disabled client buttons are insufficient. Audit manual adjustments and reject changes that silently violate availability. Test expiry/payment races and repeated consume/release.

### Checkout and payments

Protocol: resolve actor/context -> validate cart/selection -> calculate a server quote with policy/version and expiry -> lock/revalidate current buyer, seller, product, fulfillment and inventory facts -> persist pending order/reservations and operation identity -> provider request outside the database transaction -> reconcile/finalize using verified provider evidence and current-state checks.

A quote is not reserved inventory or a paid order. Confirmation binds to the reviewed selection/quote. Changed price, address, availability or fulfillment results in an explicit requote/rejection, not a silent different purchase. DEC-002 in product.md must define grouping, charges, fees and recovery calculations before acceptance.

Scope an idempotency key to actor/context and operation; bind it to a canonical input hash under a uniqueness constraint. Repeated identical input returns the existing operation/result; changed input with the same key conflicts. Record in-progress/provider correlation so timeouts/crashes can be reconciled.

Verify provider signatures over the raw body. Durably record received event identities and processing state; acknowledge according to a recoverable ingestion protocol. Duplicate, late or out-of-order events cannot apply money effects twice or regress state. There is no assumed distributed exactly-once guarantee: database constraints, idempotent provider requests, retries and reconciliation establish the required business outcome.

### Orders and recovery

Order lines contain immutable product/variant, seller, quantity, unit, currency and price facts; orders also snapshot fees, fulfillment/address and applicable policy. Separate commercial acceptance, payment and fulfillment dimensions. Derive buyer and merchant timelines from one canonical projection with permission-appropriate details.

Cancellation/refund depends on current authorized/captured/fulfilled state and approved allocation. Do not release stock on an unconfirmed provider cancellation. Refunds have durable identity, amount/item/seller/fee allocation and reconciliation. Unsupported partial operations must be unavailable with a clear explanation rather than fake success.

### Communication, delivery, reporting and AI

Persist conversations, participant authority, messages and read cursors. Authorize reads/writes/subscriptions/attachments. Stable client/message identities and cursors support retry/deduplication/reconnect. Delivery is not read state. Blocking/member removal revokes applicable access.

Write important delivery intents to an outbox in the same transaction as the domain change. A worker claims durable work with leases, bounded retry/backoff and observable terminal failure. A cron trigger, detached promise or process timer is not guaranteed background execution. Select transport/worker services under DEC-005; do not create a universal framework before requirements warrant it.

Finance has one definition per metric derived from canonical records. Unknown COGS makes profit unavailable. Reporting is not a second editable copy of financial truth.

AI reads only permitted data through bounded tools and obeys the same command rules as manual actions. Treat supplied content as untrusted. Require approval before publishing, sending messages, changing money/stock or other consequential mutations unless a separately approved bounded automation exists. Limit cost/time and keep ordinary commerce usable when AI fails.

## 5. HTTP API

Use /api/v1 for supported client endpoints and /api/webhooks/<provider> for callbacks. Implement resource families as features arrive: catalog/categories/stores, identity/context, cart, checkout quotes/confirmation, orders, messages and notifications. Do not generate unused CRUD endpoints for every table.

Define request and response schemas in @treido/contracts with units, decimal strings, currency, UTC times, limits, optional/required values and idempotency. Public DTOs exclude private commercial/account fields. Bound pagination with stable cursors and deterministic ordering.

Errors use { error: { code, message, fieldErrors? }, requestId }. Codes support client localization and recovery. Use meaningful HTTP statuses: 401 unauthenticated, 403 or deliberate non-disclosing 404 forbidden, 409 state/idempotency conflict, 422 invalid input, 429 rate limit, 503 temporary dependency failure. Never leak SQL, stack traces or another tenant's data.

Validate and test outputs as well as inputs. Enforce upload/query/action limits. Prefer additive evolution: installed mobile versions can outlive web releases. Test supported contract fixtures and plan retirement before breaking changes. Public/native packages never contain server keys or database access.

## 6. Rendering and design implementation

Use one buyer shell and separate merchant/admin layouts. Basic navigation should render without waiting for viewport detection or unrelated personalization. Use CSS for ordinary responsive web layout and narrow Client Component boundaries. Do not build two entire device trees and hide one merely to simulate responsiveness.

Specify caching for each public projection and its market/locale/filter keys plus invalidation after publication/price/availability changes. Private account/cart/checkout/merchant data are not globally shareable cache entries. Checkout always revalidates commercial truth.

Choose CSP and security headers deliberately for the installed framework and providers; request nonces and static caching have tradeoffs. Do not remove protections for a timing score. Scope optional scripts/provider work and avoid spreading auth/cookie dependencies into public content needlessly.

Use properly sized media, stable loading geometry, bounded queries and lazy noncritical maps/charts/editors. Measure production builds separately from dev compilation. Locate compute with database access in mind; global ambition does not justify speculative multi-region writes. Budgets and evidence are in verification.md.

The buyer design authority is the selected Shop reference, followed by its approved Treido adaptation. Previous Treido layouts, CSS, navigation and components are not specifications or required inputs.

## 7. Files, environments and release

Public catalog images and private attachments/invoices use separate access policies. Authorize uploads/downloads; verify content type/size/count, not just filename or claimed MIME. Private delivery is short-lived and permission-checked. Do not store raw payment card data.

Separate runtime, migration, test and operator credentials with least privilege. Verify actual environment/target before writes. Install/build cannot mutate databases or activate providers. Public/native configuration is extractable; secrets and personal data stay out of the public repository and build caches.

Initial hosting is one Next.js deployment plus native builds using its API. Deploy the exact approved production configuration, not a preview artifact with sandbox origins/keys embedded. Source checks do not authorize live release. Backup/restore, provider reconciliation and rollback are required for this new application even without importing any old data.

## 8. Decision log

| ID | Decision | Reason / change trigger |
| --- | --- | --- |
| ADR-001 | Small pnpm/Turborepo Next.js + Expo monorepo | Web/native are actual clients. Change only for a demonstrated need or incompatibility. |
| ADR-002 | One browser/backend deployment initially | Distinct experiences without unnecessary cross-app coordination. Review for independent releases/runtime/security needs. |
| ADR-003 | Shared contracts/tokens; separate platform UI | Portable meanings without a universal-component framework. |
| ADR-004 | New product-led schema on Neon/Prisma | Clear model ownership and a tested transaction system; no automatic legacy-schema import. |
| ADR-005 | Constraints, idempotency, outbox and real integration tests | Protect stock, money and permissions without an event-sourcing/microservice platform. |
| ADR-006 | Shop approval before Treido visual adaptation | Stabilize flows and geometry before branding. |

Changes record evidence, alternatives, impact, owner approval and affected tasks here. This is not a second task queue.

## Implementation references

Verify mechanisms against installed versions: [Next.js structure](https://nextjs.org/docs/app/getting-started/project-structure), [HTTP backend](https://nextjs.org/docs/app/guides/backend-for-frontend), [authorization](https://nextjs.org/docs/app/guides/authentication), [CSP](https://nextjs.org/docs/app/guides/content-security-policy), [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions), [PostgreSQL relation constraints](https://www.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode), [Stripe Connect](https://docs.stripe.com/connect/charges), [Clerk Expo](https://clerk.com/docs/expo/getting-started/quickstart), [Expo monorepos](https://docs.expo.dev/guides/monorepos/). These references do not substitute for Treido acceptance evidence.
