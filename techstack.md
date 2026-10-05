# Tech stack and compatible upgrade policy

Architecture remains the October 1 decision in [research and tradeoffs](docs/audit/2026-10-01-seller-architecture.md). Exact current declarations in all four manifests and runtime pins were rechecked October 4: [current declaration snapshot](docs/audit/dependencies-2026-10-04.json). The [October 2 registry and peer snapshot](docs/audit/dependencies-2026-10-02.json) retains its original observations; its latest-version metadata was not refreshed by the October 4 declaration read. This evidence does not qualify installed dependencies or resolve the failed vulnerability audit. No manifest, lockfile, dependency installation or running preview was changed by this documentation correction.

## Decision

Keep Next.js App Router + React + TypeScript, Tailwind 4/CSS/CSS Modules, pnpm/Turbo, Vitest and Playwright. The current app does not use StyleX; migrating styling would add risk without addressing the actual missing marketplace logic.

Build the Shopify-inspired seller workspace at `/app` inside `app/apps/web`. Select a modular monolith: one application, one authoritative relational domain, feature-owned server use cases, and managed external services for identity, payments, storage and durable execution. This is the best fit for Treido's current code and mixed personal/business marketplace requirements; it is not a universal ranking of 2026 frameworks. D27–D29 in [decisions](docs/decisions.md) close the engineering direction. Provider resource bindings and commercial activation remain explicit integration work.

Retain the existing web/mobile/contracts workspace. Responsive web leads. Use Node 24 LTS for a stable supported line, not the newest non-LTS major simply because its number is higher. [Node release policy](https://nodejs.org/en/about/previous-releases) is the authority; recheck the exact patch before the upgrade task.

T35 adds exact `next-intl 4.14.9` for shared request negotiation, typed message catalogues, ICU plurals and locale-aware formatting. Existing `lang` URLs remain stable; no route-tree or visual-framework migration. The pinned release supports the installed Next 16/React 19 pair. A fresh frozen install passed; build-script decisions are explicit. Native Expo packages were not migrated.

## Observed pins and targets

| Package/group             | Declared pin    | Latest at review | Qualification plan                                         |
| ------------------------- | --------------- | ---------------- | ---------------------------------------------------------- |
| Node LTS                  | 24.20.0         | 24.21.0          | Qualify the 24.x patch; do not replace LTS with Current 26 |
| pnpm                      | 12.3.4          | 12.8.1           | T02c: exact toolchain plus frozen-lockfile qualification   |
| Next + eslint-config-next | 16.3.8          | 16.3.8           | Paired source pin delivered; remaining audit/release gates stay open |
| React + React DOM         | 19.2.3          | 19.3.0           | T02d: align pair, types, auth and Expo consumers           |
| next-intl                 | 4.14.9          | 4.14.9           | T35: typed BG/EN request/client and Studio catalogues      |
| Tailwind + PostCSS        | 4.3.3           | 4.3.3            | Keep current styling system                                |
| TypeScript                | 6.0.3           | 7.0.2            | Hold: current typescript-eslint peer excludes 7            |
| typescript-eslint         | 8.70.0          | 8.71.0           | Peer remains >=4.8.4 <6.1.0; review patch separately       |
| ESLint / @eslint/js       | 9.39.5          | 10.11.0 / 10.0.1 | Separate major/config migration, including native config   |
| Prettier                  | 3.9.6           | 3.9.9            | Separate patch, not a repository-wide format pass          |
| Vitest                    | 5.0.0           | 5.0.3            | Compare the same selected tests                            |
| Playwright                | 1.63.0          | 1.63.0           | Runner/browser alignment; preserve baselines               |
| Turbo                     | 2.10.12         | 2.11.6           | Tooling batch after reproducible checks                    |
| Zod                       | 4.5.4           | 4.6.5            | Validate shared contracts and serialization                |
| Clerk Next SDK            | 7.9.9           | 7.9.10           | Review authentication/session regression cases             |
| Drizzle ORM / pg          | 0.45.3 / 8.23.1 | 0.45.3 / 8.23.1  | Keep; retain database-role and transaction evidence        |
| Inngest                   | 4.21.0          | 4.21.1           | Qualify replay/handler compatibility                       |
| aws4fetch                 | 1.0.20          | 1.0.20           | Keep; actual R2 binding is a separate gate                 |
| Sharp                     | 0.35.4          | 0.35.5           | Review processing/output confinement and image regression  |
| Expo                      | 57.0.21         | 57.0.26          | Native-scoped SDK-coherent update                          |
| React Native              | 0.86.3          | 0.87.1           | Do not upgrade independently of Expo                       |
| embedded-postgres         | 18.4.0-beta.17  | 18.4.0-beta.17   | Development-only beta test tool; not production database   |

The default shell reported Node 22.20.0 and pnpm 10.32.1. Those are not the declared project runtime. Pinned Node 24.20.0 exists locally and was used for unit/lint checks. Do not modify global toolchains for other projects; select the correct executable/session.

## Backend choices — installed SDKs versus qualified services

The current manifest installs Clerk, Drizzle, pg, Inngest, aws4fetch and Sharp. Their presence is not evidence of intended live account/project/region binding. The rows below specify service ownership, not a claim that every service is installed or connected. [Backend](docs/backend.md) and [seller workspace](docs/seller-workspace.md) describe implemented adapters; [tasks](tasks.md) records their outstanding acceptance.

| Need                          | Choice / reason                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication                | Clerk SDK for verified human sessions and account security; local User/Seller/Membership tables own seller authority. No Clerk Organizations or Clerk Billing as a second tenant/entitlement system                                   |
| Persistence                   | Neon PostgreSQL in an intended EU region; ordinary relational constraints and transactions. Isolated schema/synthetic-data test branches, never an unreviewed production-data copy                                                    |
| Schema/query layer            | Drizzle + `pg` on Node; reviewed SQL migrations, bounded reusable pool, one transaction client. the current project uses its own reviewed SQL migration runner; drizzle-kit is not currently declared                                 |
| Validation                    | Existing Zod, shared only where contracts genuinely cross runtimes                                                                                                                                                                    |
| Search                        | Indexed PostgreSQL first; dedicated engine only after measured relevance/latency limits                                                                                                                                               |
| Media                         | Cloudflare R2 through its S3 API, private staging and delivery. Select EU jurisdiction explicitly when binding; a location hint alone does not guarantee it. Owned sanitized derivatives and fresh visibility checks                  |
| Mail                          | Resend with a verified sender, application delivery ledger and provider idempotency; add with the first invite/notification consumer                                                                                                  |
| Subscriptions / item payments | Stripe Billing / Connect respectively, subject to country/entity/provider eligibility and approved commercial policy                                                                                                                  |
| Promotions                    | Separate Stripe payment purpose plus server-owned delivery/capacity; no browser-paid flag                                                                                                                                             |
| Shopping assistants           | Proposed AI SDK plus Vercel AI Gateway and qualified OpenAI model; typed read tools, evals and per-human budgets; [assistants](docs/assistants.md) owns choice                                                                        |
| Business catalogue            | Same PostgreSQL SKU/allocation and bounded CSV draft jobs; no separate commerce engine required for variants                                                                                                                          |
| Jobs                          | PostgreSQL transactional outbox plus Inngest for durable steps/retries/concurrency. A small leased dispatcher hands off committed intent; it is not a second workflow engine. T04f qualifies this before media/import/payment effects |
| Hosting                       | Vercel Node/Fluid compute for the existing Next app; EU compute close to the selected Neon region. One web deployment initially, no separate merchant/API deployment                                                                  |
| Observability                 | Structured redacted logs plus Sentry error capture/traces, correlation IDs and actionable job/payment alerts; session replay off initially. Business metrics derive from owned events/orders                                          |

The October 2 snapshot distinguishes installed manifest pins from latest tags. Unused candidate tooling is not installed merely because it appeared in earlier research. Do not provision accounts, install unused providers, reuse donor credentials or replace this with another backend just because a connector exists.

Earlier September 28 observations remain in their dated evidence file; the table above supersedes them for this October 2 review. Version metadata must still be refreshed when an upgrade actually starts. The owner has accounts available, but intended account/project/region/mode bindings still need task evidence. Follow official installed-package docs at integration time; do not pin a model/version guessed from this plan or add both AI SDK and Agents SDK loops for the same run.

R2, Resend, Inngest, Sentry and Vercel are now selected engineering targets, superseding D11's candidate list. This does not assert that their accounts, plans, EU processing, quotas or billing are configured. [Operations](docs/operations.md) owns binding/retention/cost qualification. Missing optional integrations cannot disable unrelated working capabilities; an enabled feature with a failed required integration returns an explicit unavailable/pending result.

## Why not migrate to next-forge?

[next-forge's structure](https://www.next-forge.com/docs/structure) separates deployable apps and shared packages; its [database default](https://www.next-forge.com/docs/packages/database) is Neon with Prisma, with other ORMs supported. It is a credible starting point for a new SaaS. Here, an existing Next/pnpm/Turbo workspace, copied visual system, routes and tested category/editor contracts already exist. Moving them to a new scaffold would still leave Treido's seller model and commerce rules to implement.

Adopt its useful ideas: explicit environment validation, server-only integration adapters, small reusable packages when there are real consumers, and observability. Keep our Drizzle choice, existing CSS, package names and one web app. Do not run `next-forge init`, copy its whole package graph, replace the design system, add Prisma alongside Drizzle, or silently disable a required provider to make a route appear successful.

| Alternative considered                               | Decision for this product                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| next-forge as the new foundation                     | Reference patterns only; migration does not deliver marketplace ownership, offers, quotas or stock/payment races                                                                                                                                                                                        |
| Shopify as Treido's backend                          | Merchant UX reference. Treido owns its marketplace sellers, listings and obligations; no Shopify account/store per personal seller                                                                                                                                                                      |
| Medusa commerce backend                              | Useful if commerce-engine replacement becomes a separately justified goal. Its [marketplace recipe](https://docs.medusajs.com/resources/recipes/marketplace) still requires custom vendor models/routes/workflows; adding it now splits domain ownership and replaces the selected persistence boundary |
| Separate NestJS/GraphQL/API service or microservices | Revisit for an actual independently deployed consumer/team or measured runtime limit. Route Handlers already serve real HTTP needs; no self-HTTP from Server Components                                                                                                                                 |
| Prisma instead of Drizzle                            | Viable ORM, but no evidenced requirement justifies switching. Drizzle plus reviewed SQL keeps the planned constraints/locks explicit; either ORM still requires correct transactions                                                                                                                    |
| Vercel Workflow instead of Inngest                   | Credible durable-execution alternative. Choose one executor: Inngest's explicit events, steps and concurrency controls fit the planned handlers on the app's Node compute. Revisit only for measured cost, runtime, regional or operating constraints                                                   |
| Redis, dedicated search, realtime sockets            | Add only for measured need. PostgreSQL search/counters and bounded authenticated inbox polling cover the first implementation; no extra source of stock or permission truth                                                                                                                             |

## Install by consuming slice

T04e's pure seller policies need no provider. T04b adds compatible pinned Clerk/Drizzle/pg packages and isolated migrations. T04f adds the single job executor and its narrow outbox integration. T06b adds R2; T10a/notification work adds Resend; T12 adds Stripe; early hosted qualification adds Sentry. T15 alone qualifies AI packages/models. Keep form state in the existing reducers and URL-owned table filters; introduce a form/table/query library only for a demonstrated consumer, not a second application state system.

Node 24, Next 16, React 19 and the current TypeScript/Tailwind major lines remain the baseline subject to T02's security and compatibility gates. Selection is not a recommendation to ship the currently flagged dependency set unchanged. Recheck exact stable patches and peer ranges at installation; do not pin new packages to a stale research number.

## October 2 security and compatibility priorities

[Next 16.3.8 release notes](https://github.com/vercel/next.js/releases/tag/v16.3.8) identify security fixes, including image-optimization SSRF and cache/information-disclosure cases. T02b must review applicability and qualify the paired Next/config patch before release; a registry comparison is not a fresh dependency audit or proof of exploitability. T02a's earlier failed audit remains unresolved until a new qualified run passes. Do not silently suppress advisories.

[typescript-eslint support](https://typescript-eslint.io/users/dependency-versions/) and the fresh registry peer metadata still exclude TypeScript 7. Keeping 6.0.3 is an explicit compatibility hold, not an unnoticed stale version. Node 24 remains the LTS line; qualify 24.21.0 with the current app/tooling rather than switching to Current 26.

## Upgrade batches

**T01: reproducibility.** Run the copied pins first, inspect peers/runtime, verify a fresh frozen install and safe preview. Save test/visual evidence before changing versions.

**T02a: reproducible CI and release review.** Establish frozen install, lint/types/unit/build and boundary checks with the existing compatible pins. Inspect current advisories/peers. Required fixes get their own qualified patch batch before release; optional version changes do not block otherwise compatible product work.

**T02b: framework/security patches.** Check release notes and current advisories, update Next and its config together, then Sharp and needed compatible patches in a small diff. Keep current React until its separate compatibility check. Run typecheck/build, reference rejection, affected journeys and visual comparisons. Do not call a patch “safe” without these checks.

**T02c: tooling.** Update pnpm/Turbo/test/format/lint patches in separated changes. Keep exact versions, one lockfile, strict peers and existing install protections. A package-manager update may change lockfile format; verify a clean frozen install in CI. Review security exceptions individually, never disable protections globally.

**T02d: deliberate majors/minors.** Qualify React together with DOM/types/native/auth consumers. Qualify ESLint 10 across both web and Expo configs. TypeScript 7 remains blocked while the dated typescript-eslint peer excludes it; recheck at execution and do not suppress peer errors to claim “latest.” Native updates use Expo's compatibility checks, not `pnpm up --latest` across the workspace. September 30 queue reserves T02a for CI; these batch IDs supersede the earlier shorthand without changing existing completion evidence.

For every batch record old/new versions, release/advisory references, peer matrix, lockfile diff, tests and rollback. Revert that batch if it regresses; do not combine its repair with a UI rewrite. Exact “latest” versions must be re-queried when execution begins.

### Embedded authentication language

T37 adds exact `@clerk/localizations 4.21.2` for the existing Clerk 7.9.9 integration. Load only the selected BG/EN dictionary on the server and pass it to ClerkProvider in authentication, seller layout and direct Sell. This changes embedded UI copy, not authentication policy, provider bindings or appearance. The external Clerk Account Portal and provider-managed email/SMS templates are separate surfaces.
