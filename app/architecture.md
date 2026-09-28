> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Architecture

## One commerce owner, separate experiences

Keep the existing pnpm/Turborepo workspace. `apps/web` is the Next.js browser platform AND initial authoritative backend. `apps/mobile` is an Expo buyer client. `packages/contracts` contains portable, client-safe inputs, DTOs and errors. Tokens/messages become shared packages only when real consumers justify them. Do not introduce microservices, a second API app, universal web/native components or a framework migration during UI work.

Buyer, merchant and platform-admin layouts are separate inside `apps/web`; expensive editor/chart dependencies must not enter the buyer's initial bundle. `app.md` is a product contract, not permission to create `apps/app`. The old `treido-next` topology is not this repository's architecture.

The current implementation is primarily reference UI. The server modules, Prisma schema, supported native API and provider integrations below are selected architecture, not all installed code. Inspect the actual tree before naming a module as implemented.

## Request and dependency boundaries

Web Server Components/Actions call named feature services directly. Native `/api/v1` Route Handlers invoke the SAME operations. Signed webhooks and authorized jobs enter the same domain rules. Do not make the server call its own HTTP API unnecessarily or expose Server Actions as the native protocol.

Use small feature-owned queries/commands/policies where useful. Guard server-only modules. Shared/client code cannot import Prisma, secrets, `next/headers`, server-only or Node runtime dependencies. Avoid generic repository/controller layers without a demonstrated need.

Next.js App Router and React own browser rendering; Expo Router/React Native own native UI. Neon PostgreSQL + Prisma, Clerk identity and Stripe payments remain the selected later integrations. No database or identity provider was switched by the Astra update.

## Identity and tenant isolation

Authentication establishes the person; the server resolves active local identity, business membership, role and resource authority. A business ID in a route, cookie or token is requested context, not proof of access. Reauthorize private reads, writes, exports, files, subscriptions and consequential actions at their owner.

Private caches and realtime subscriptions are actor/business scoped. Workspace changes, logout and revocation retire stale requests and cached state. Late responses must not repopulate another account. Web cookie mutations require appropriate same-origin/CSRF defenses; native bearer tokens require provider-supported validation. CORS and a hidden menu are not authorization.

## Money, quantities and stock

Use integer minor currency units and exact scaled/decimal quantities, with explicit bounds and API decimal strings. Products own content; variants own sellable identity and quantity rules. Purchase snapshots retain the actual seller, variant, unit, quantity, price, fee, fulfillment and applicable policy. Separate commercial acceptance, payment and fulfillment states.

Inventory uses transactional constraints/conditional updates or locks, durable reservations and auditable adjustments. Expiry, cancellation and successful consumption must not double-release/consume stock. Client-disabled buttons and in-memory locks do not prevent overselling. Test last-stock competition and payment/expiry races against real isolated PostgreSQL.

## Checkout and recovery

Resolve authority -> validate selection -> produce versioned expiring server quote -> revalidate and reserve current facts transactionally -> persist a durable pending operation -> call the provider outside the database transaction -> reconcile using verified provider evidence. Quote changes need explicit buyer review. The browser/native redirect cannot mark an order paid.

Bind idempotency to actor/context, operation and canonical input under a uniqueness constraint. Same key/different input conflicts. Verify webhook signatures over the raw body; durably deduplicate and process retries/late events without duplicate or regressed effects. There is no assumed distributed exactly-once delivery guarantee.

DEC-002 defines fee/grouping/refund/settlement policy. Refund operations retain original allocations and provider correlation. Money state and physical restocking are separate decisions. Unknown provider outcomes stay pending/reconciling, not fabricated success.

## CMS, communications and AI

CMS uses validated typed sections, tenant-scoped resources, revision-aware drafts and immutable published versions. Preview and public pages share the renderer. Publishing/rollback revalidate current authority and invalidate affected public content; prior versions cannot resurrect suspended products. See [app.md](app.md).

Durable messages and read cursors agree across clients; authorize subscriptions and private attachments. Write important delivery intents transactionally with domain changes, then process with bounded retry/leases and observable failure. Select job/realtime providers when their actual tasks require them; a detached promise is not reliable delivery.

AI uses bounded, authorized tools and the same command services as humans. Retrieved text is untrusted. Review precedes publishing, sending, stock/money changes and other consequential actions. Missing AI leaves ordinary commerce usable. See [ai.md](ai.md).

## Rendering, environments and release

Use CSS for ordinary responsiveness, narrow client boundaries and one canonical UI per role. Scope public caching by market/locale/projection and invalidate deliberately. Private checkout/account/merchant data must not enter public cache. Commercial truth is revalidated at confirmation regardless of cache policy.

Public media and private attachments have distinct access policies. Validate upload type/size/count and resource ownership. Separate runtime/migration/test/operator credentials. Never mutate a database during install/build or use missing test configuration to fall back to production.

[Detailed engineering boundaries](docs/engineering/architecture-detail.md) preserve transaction, API, outbox, security, performance and recovery specifics. [Decisions](docs/product/decisions.md) owns pending policy; [verification.md](verification.md) owns proof. Necessary architecture changes require an evidence-backed decision, not a routine stack debate.
