# Sources and evidence

## Current pattern references checked on 1 October 2026

Public documentation is a pattern library, not Treido's implementation or a backend license. The local Shop reconstruction and retained native evidence are visual references; inspect the relevant dated state rather than assuming complete native parity. The assigned `emulator-5560` was absent from ADB on this audit; no fresh Android comparison is claimed.

| Source | Adopt for Treido | Boundary |
|---|---|---|
| [Shop customer experience](https://help.shopify.com/en/manual/online-sales-channels/shop/customer-experience) | Product/store discovery, follows, saved collections, order continuity | Geography, payments and recommendation behavior belong to Shopify; our implementation needs its own contracts |
| [Shop store customization](https://help.shopify.com/en/manual/online-sales-channels/shop/manage-shop-store/customize) | Seller profile, collections and authored storefront sections | Storefront composition does not automatically control the marketplace Home feed |
| [Shop Minis](https://shopify.dev/docs/api/shop-minis) and [design](https://shopify.dev/docs/api/shop-minis/design) | A clear purpose, reusable shopping controls, saved progress and accessible task completion | Official Minis run inside Shop. Treido's tools do not inherit the SDK host, catalog, users, distribution or publishing approval |
| [Wolt Drive](https://developer.wolt.com/docs/wolt-drive) | Separate delivery availability, booking, status and tracking contracts | No Treido coverage/account/integration established by reading the API |

For each implementation task, record the user job, exact source/date/platform, useful behavior, intentional Treido adaptation, data/permission owner and positive/error/return acceptance. Prefer official documentation and our verified contracts to copied marketing text. Do not copy captured brands, reviews, delivery promises or fonts into production merely because they exist in a reference checkout.

## Older code reuse assessment

Current read-only sampling also verified Next's quantity/quote/inventory owners, J:/amazong's category-policy and checkout idempotency tests, and G:/codex-app/treido's checkout actions/payment handlers. J and H Amazong share HEAD 5fa9c7f0 but have different dirty trees; they must not be treated as interchangeable. E:/treido-global remains a prior reference/planning checkout.

Adopt failure cases and domain distinctions; reimplement persistence-sensitive behavior against this app's own schema and identity. For example, Amazong distinguishes transaction mode from fulfillment mode, but its fallback defaults must not enable an unreviewed category. Its checkout subtotal helper converts cents to floating major units; do not import that as the new money authority. Supabase RPC/RLS and Prisma transaction assumptions need deliberate adapters or rewritten destination services. A donor's mock idempotency test is not proof of PostgreSQL concurrency or a connected provider here.


Initial audit September 28; expanded product/source research September 30, 2026. This register supplies provenance and primary references, not a second set of requirements. [Tasks](tasks.md) owns progress; [decisions](docs/decisions.md) owns choices; [audit](docs/audit/2026-09-28.md) distinguishes earlier observations from targets. September 30 evidence is in T22's local artifact directory.

## Current source identity

Canonical local root: `L:/PLATFORMS/treido-eu-global`; existing workspace `app/`; main web owner `app/apps/web`. T19 physically relocated the existing checkout on September 30; the September 28 inspection below used its former `L:/CODEX/platforms/treido` location. Local main at inspection: `9ad9da38d769d8944442a28e093cbae5336f47cb`, initially clean, no local remote. Intended public repository: [darkapoparka/treido-eu](https://github.com/darkapoparka/treido-eu). Its GitHub contents at the initial inspection were README-only; that README identifies this local copied source. Before this documentation write, a concurrent repository connection set `origin` to the intended repository. Final local HEAD and `git ls-remote origin refs/heads/main` both returned `986f328f1ffe4523a251547d44ca2576c160c860`; its tree matches the initial tree (`903170676f36fc2192e79e2bd4f1881d2bdecded`). The README difference was line endings only. The change was reviewed and preserved; this documentation pass did not create those commits, configure the remote or push.

The September 27 organization records report a SHA256-verified copy from `L:/CODEX/treido-bg`, source HEAD `7ab4dd99c535f88806b63ef2457e203021253cc9`, 7,775 files / 715,450,113 bytes. The old copy manifest is `../_organization/2026-09-27-finalize-185118/treido-source-copy.json` outside this product repo. These are **historical copy results**, not a new all-asset rehash by this audit.

The reusable source's physical location is now `L:/inspiration/shop-app`, with private origin `darkapoparka/inspiration-shop`. Its former physical path, `L:/CODEX/treido-bg`, and `L:/CODEX/platforms/treido-bg` are hidden compatibility junctions to the same checkout. The September 27 copy report above uses the former source location. The source is separate from the active product at `L:/PLATFORMS/treido-bg-shop`; similarly named paths do not imply synchronized code. Relocation evidence is linked from T18 in [tasks](tasks.md). The copied Treido EU app is already present; do not copy it again or import donor `.git`, credentials or automation. Earlier notes saying no install occurred described the organization pass; this audit found installed dependencies and ran unit/lint checks in the copied app.

## Legacy product knowledge used

Inspected the existing product-root PRD/architecture/billing/tasks and `M:/treidotyj/README.md`, `M:/treidotyj/docs/data-model.md`. Useful retained ideas: human versus seller identity, immutable ownership, business memberships, personal/business plans, listing lifecycle, offers/allocation, payment reconciliation, privacy and honest metrics.

Do not import the older Supabase/RPC topology, food requirements, old prices as live offers, old visual gate requiring full Shop reconstruction, or a second active project queue. The parked Obqvi provenance is historical overlap. The September 28 inspection was limited; the focused September 30 recovery below adds the older Global/Amazong references without claiming an exhaustive audit of every drive or execution of their apps.

## Recovered planning locations — September 30

| Physical/reference location | Inspected evidence | Reuse / authority |
|---|---|---|
| `L:/PLATFORMS/treido-eu-global` | Current root docs, app manifest/query boundaries, tasks and remote `darkapoparka/treido-eu`, HEAD `986f328` | Sole active general-goods implementation/docs root; local dirty work preserved |
| `E:/treido-global` | `product.md`, `docs/product/requirements.md`, `docs/project-comparison.md`; clean checkout at `a736584`, September 22, remote `darkapoparka/treido-global` | The newer recovered Global product/reuse pass; useful domain direction, not another active build |
| `M:/treidotyj` | `README.md`, `platform.md`, `prd.md`, feature/catalogue/data-model plans; September 8 docs, September 11 HEAD `6c64d3e`, 13 local status entries | Earlier rich planning; retain human/seller/membership and lifecycle ideas, supersede old topology/clone-first gate |
| `M:/treido` → `G:/codex-app/treido` | Older app: `lib/treido/checkout-actions.ts`, payments, `components/layout/sidebar/top-categories.ts`, migrations including `20260428143000_canonical_browse_taxonomy.sql` | Candidate pure rules/migration/test ideas; present code is not qualified compatibility, runtime or live payment evidence |
| `H:/amazong` | `docs/00-index.md`, `10-prd.md`, `15-taxonomy.md`, `20-monetization.md`, `21-premium-plans.md`, `23-launch-plan.md`; March 22 HEAD `5fa9c7f0` | Nine roots/36 leaves and commercial ideas used as inputs; do not inherit live services/whole-vehicle exposure or prices |
| `J:/amazong` | Same HEAD/remote, independently dirty working tree; `lib/sell/category-policy.ts`, shared checkout-session code and idempotency tests | Useful category/transaction/fulfilment policy separation; do not merge or overwrite either Amazong working tree |
| `L:/inspiration/shop-app` | `apps/web/src/features/discovery/mini-model.ts`, `minis.tsx`, `sol.tsx` and shared seller presentation | Read-only Shop-derived visual/reference behavior; reference Minis are not inventory-backed agents |

Read-only local chat metadata identifies **“Audit Treido commerce projects”**, September 22, cwd `E:/treido-global`, model `gpt-6-astra`, chat `01a0c8b4-47fc-72f1-8432-6f61ab494509`. Its original rollout file is missing and the chat reader cannot retrieve the source conversation. Surviving document contents and Git state were inspected directly; no reconstruction of missing messages is claimed. This answers where the likely Astra planning work lives while preserving uncertainty about unavailable chat contents.

Older `L:/CODEX/platforms/treido` and `L:/PLATFORMS/treido` are temporary junctions to this current root, not copies with newer docs. H:/J: Amazong have different dirty states despite the same HEAD; M:/treido is a junction to G:. No reference project, database, credentials or history was moved, imported or modified during planning.

Current `/minis` was inspected in the browser on 6418: the reference catalogue renders, and Gift Sense asks for sign-in. Source/current code includes captured assistant responses and fixture identities; the Shop source port was not running during this inspection. This is source plus current-browser evidence, not live source/native/authenticated assistant parity. [Assistants](docs/assistants.md) specifies useful replacements.

<a id="september-30-product-research"></a>
## September 30 product research

The plan is Treido's own proposed implementation; provider/product pages support the concepts below and do not prove account integration, legal approval or competitive superiority.

| Primary source | Grounded implication |
|---|---|
| [OLX Business features](https://business.olx.bg/homepage/features/) and [Bazar help](https://bazar.bg/help) | Useful business stores, listing operations, insights/import/delivery topics already exist; Treido's business filter needs real catalogue/workspace tools |
| [Council euro decision](https://www.consilium.europa.eu/en/press/press-releases/2025/07/08/bulgaria-ready-to-use-the-euro-from-1-january-2026-council-takes-final-steps/) | Bulgaria's euro adoption date is January 1, 2026; recommend explicit EUR amounts for this September/October product, with current display/tax rules qualified separately |
| [OpenAI agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Model instructions/tools and schema-bounded output are building blocks; server validation/authorization and evaluation remain necessary |
| [AI SDK ToolLoopAgent](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) and [Vercel AI Gateway SDK/API](https://vercel.com/docs/ai-gateway/sdks-and-apis) | Proposed tool loop plus model gateway, with supported installed APIs/model selection verified during T15; no asserted model price or installed package |
| [Stripe charge types](https://docs.stripe.com/connect/charges) and [subscription overview](https://docs.stripe.com/billing/subscriptions/overview) | Item payment/settlement and subscription lifecycles have distinct responsibilities; charge/liability/country eligibility and actual plan mapping must be qualified |
| [DSA](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act) and [GPSR summary](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=LEGISSUM%3A4670517) | Notice/action, trader transparency and product-safety handling need applicable launch review; not all broad physical-goods leaves can be exposed without policy |

The direct Commission product-safety topic page failed to open in this research session; official Commission search results and EUR-Lex were available. No claim is based on a fabricated page response. Proposed fees, quotas, assistant limits and category breadth are product recommendations documented in their owning files, not numbers copied from these sources.

<a id="marketplace-research"></a>
## Marketplace research — primary product sources

| Source | What was observed / implication for Treido |
|---|---|
| [OLX Business Bulgaria](https://business.olx.bg/) and [features](https://business.olx.bg/homepage/features/) | Business pages, listing packages, listing operations, performance statistics and delivery support are already marketplace expectations. Treido needs useful business operations, not just a colored account badge. No traffic/pricing marketing claim is adopted as our forecast. |
| [Bazar.bg](https://bazar.bg/) and [help](https://bazar.bg/help) | Broad category discovery, listing creation, stores, offers, safety guidance and import topics. Breadth needs a usable taxonomy, seller communication and safety—not merely a retail product feed. |
| [eBay item condition](https://www.ebay.com/help/selling/listings/creating-managing-listings/item-conditions-category?id=4765) | Condition is structured and category-dependent. Retain condition/defects as explicit listing data, independent of seller type. Do not reproduce every eBay policy or auction flow in the initial release. |
| [EU shopping rights](https://europa.eu/youreurope/citizens/consumers/shopping/shopping-consumer-rights/index_en.htm) | Trader/private distinction affects buyer protections; second-hand goods from traders are not equivalent to private sales. Declared mode is not a license to misclassify a professional trader. |
| [EU guarantees](https://europa.eu/youreurope/citizens/consumers/shopping/guarantees/indexamp_en.htm) | Statutory rights and additional commercial guarantees are distinct. Do not label every business listing “new with warranty.” Obtain country-specific review before publishing legal promises. |

Product recommendation, not a competitor fact: preserve the existing high-quality shopping surface, make the personal/business filter genuinely useful, and deliver reliable publish/contact/purchase journeys before adding breadth. These sources do not prove that Treido is “best,” that competitors lack a feature, or that a market-size claim is independently verified.

<a id="technical-references"></a>
## Framework and tooling references

- [Next server/client components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — render/import boundaries and narrow client islands.
- [Next data security](https://nextjs.org/docs/app/guides/data-security) — server data access, validation, authorization and minimized responses.
- [Next use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache), [revalidation](https://nextjs.org/docs/app/getting-started/revalidating), [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) — opt-in configuration and freshness semantics.
- [Tailwind theme](https://tailwindcss.com/docs/theme) — existing token/CSS system; not a new design specification.
- [Node releases](https://nodejs.org/en/about/previous-releases) — supported runtime lines.
- [npm registry](https://registry.npmjs.org/) — live `/latest` metadata, version/engine/peer fields captured in [the dated snapshot](docs/audit/dependencies-2026-09-28.json). Dist-tags must be rechecked when upgrading.
- [Codex AGENTS](https://developers.openai.com/codex/guides/agents-md) and [skills](https://developers.openai.com/codex/skills) — instruction discovery and `.agents/skills/*/SKILL.md`; other launchers need their own discovery verification.

## Backend and release references

- [Drizzle transactions](https://orm.drizzle.team/docs/transactions) and [Neon latency/pooling](https://neon.com/blog/how-to-minimise-the-impact-of-database-latency) — transactional SQL integration and bounded connection use. The direct Neon pooling documentation endpoint did not load through this research tool; no exact account/pool limit is asserted.
- [Clerk server auth](https://clerk.com/docs/reference/nextjs/app-router/auth), [authorization](https://clerk.com/docs/guides/secure/authorization-checks) — SDK checks; application seller authority remains explicit.
- [Stripe charge types](https://docs.stripe.com/connect/charges), [webhooks](https://docs.stripe.com/webhooks) — integration references, not verified account eligibility or approved fee policy.
- [Digital Services Act](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act), [EU product safety](https://commission.europa.eu/topics/business-and-industry/product-safety_en), [DAC7](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/dac7_en) — starting points for a qualified launch/applicability review, not a legal certification.

Use official documentation matching the installed version. These public references do not establish access to any provider account, the presence of a deployed backend, or permission to publish third-party assets.
