# Tech stack — Treido Global / general marketplace

**Organization status:** the current app path, frontend status and decisions are in README.md and sources.md. This document retains technical proposals for later implementation, not proof of the installed architecture or permission to replace existing backend work. No dependencies, providers or database changes are authorized in this phase. Use the actual selected repository manifest/lockfile when Phase 2 begins.

## Frontend

Next.js / React / TypeScript with the selected Shop implementation's Tailwind/CSS and lockfile; do not port it to Svelte or StyleX.

Use the selected clone’s manifest, package manager and lockfile for exact versions. Preserve its internal workspace structure; no framework/styling migration as setup. For a missing clone use the stack stated above and pin compatible stable dependencies when reconstruction starts.

## Proposed backend integration — Phase 2, after source reconciliation

**Node runtime + Neon PostgreSQL + Drizzle + Clerk**, inside the existing server-capable application rather than a new service fleet. For a Next app use its server modules/actions/route handlers. Add modules to the actual package that owns the feature; do not flatten a working monorepo merely to match example paths.

Install `drizzle-orm`, a compatible `pg` driver, `drizzle-kit` for migrations and `zod` where absent; integrate the supported Clerk SDK for the actual client. Use a bounded Node connection pool for transactions. Secrets and database imports stay server-side. Record schema/migration/seed scripts in the real package manifest and document the commands after checking them.

Bind the product’s intended isolated development Neon database and auth application through the available tools. Reuse verified existing bindings; no automatic migration of old product data. Generate and apply this derivative’s own initial schema there. Missing credentials do not block writing modules, tests and explicit fixture adapters, but fixtures are not authenticated integration evidence.

## Add when the feature needs it

| Need | Implementation choice |
|---|---|
| Search | Indexed PostgreSQL queries/text/trigram first |
| Images/private files | Existing suitable storage; otherwise S3-compatible storage, with R2 the proposal |
| Mail | Existing sender; otherwise Resend the proposal |
| Payments | Stripe SDK and this product’s billing.md; account/mode/Prices mapped for the paid task |
| Reliable delayed effects | Persist intent with the domain change and add a small retrying runner when a feature needs one |
| Checks | Existing donor checks plus domain, database and browser tests for changed behavior |

Do not install unused integrations or build a general job framework before the first feature. A provider plugin helps the agent configure a service; the deployed application still needs its own connection and server integration.

Responsive web first; native Expo, cross-border selling and richer inventory are retained later decisions, not implied by Android-inspired web screens.

## Runtime notes

When the owner starts implementation, record actual install/dev/check commands and port in README. The backend task records nonsecret environment variable names and target purposes in the app’s environment schema/example; values stay out of docs/Git. Use [sources.md](sources.md#technical-references) only for API documentation or historical context.
