# Treido EU Global — general marketplace

## Current entry — October 2, 2026

The Shop-derived buyer frontend and Shopify-derived seller Studio are both preserved. Studio has a broad, guarded `/admin-preview` interface; real Clerk/pg/Drizzle seller/draft/setup adapters and private `/app` routes also exist, but intended live bindings, complete marketplace behavior and production acceptance remain unqualified. These are different readiness levels, not a finished Shopify backend.

Start with [AGENTS](AGENTS.md), the current named task in [tasks](tasks.md), and [documentation ownership](docs/documentation.md). For rendering, use [UI patterns](docs/ui-patterns.md) and [UI verification](docs/ui-verification.md). T31 records the October 2 documentation/stack review; T30b–T30g retain the merchant implementation evidence and remaining parity gaps. New Next.js security patches require T02b qualification before release; dependencies were audited, not silently upgraded beneath the running preview.

## Selected Global foundation

Final selection, 1 October 2026: build Global here and Foods in `L:/PLATFORMS/treido-bg-shop`. Wolt and Next are parked donors. [Platform](platform.md) and [decisions](docs/decisions.md) lock the choice; [styling](styling.md) permits the named marketplace adaptations while preserving the Shop visual language.

The current local catalog still requires reference mode and there is no production catalog adapter. Reference checkout and captured delivery copy are not marketplace services. [Tasks](tasks.md) records the current audit and implementation work; the full October 1 target is a target, not completed acceptance.


A general marketplace where people and businesses sell new, used and refurbished physical goods. Bulgaria first; designed for later country-by-country expansion. Treido keeps the existing Shop-inspired visual system and replaces the reference application's logic with trustworthy marketplace behavior.

## Work here

- **Git and documentation:** `L:/PLATFORMS/treido-eu-global` (physical checkout)
- **Package workspace:** `app/`; **web application:** `app/apps/web`
- **Intended GitHub repository:** `darkapoparka/treido-eu`

Do not copy or scaffold another app. The reusable Shop source at `L:/inspiration/shop-app` is separate from this product. At the final September 28, 2026 check, local `main` and the GitHub remote both resolve to `986f328f1ffe4523a251547d44ca2576c160c860`, and `origin` points to `darkapoparka/treido-eu`. The repository was connected during this audit without changing the initial source tree. These documentation and implementation changes are local and uncommitted. Further publication still needs an asset/secret/history review; the existing connection is not evidence that reference assets are cleared for release.

## Project and reference folders

These are separate Git checkouts. Improvements in one product do not automatically appear in another.

| Folder | Role |
|---|---|
| `L:/PLATFORMS/treido-bg-shop` | Selected active Treido Foods product |
| `L:/PLATFORMS/treido-bg-wolt` | Parked food-ordering and UI donor |
| `L:/PLATFORMS/treido-bg-next` | Parked food-domain, tests and desktop donor |
| `L:/PLATFORMS/treido-eu-global` | This separate Treido EU general physical-goods marketplace |
| `L:/inspiration/shop-app` | Physical reusable Shop reference clone; private origin `darkapoparka/inspiration-shop` |
| `L:/inspiration/wolt` | Separate reusable Wolt reference clone |

The former `L:/CODEX/platforms/treido` location and `L:/PLATFORMS/treido` entry temporarily resolve to this physical checkout. The old CODEX source/product links remain only while T20 migrates their consumers and retires `L:/CODEX`. They are not independent copies. `M:/treido-next` resolves to the original Next checkout; `L:/PLATFORMS/treido-foods` resolves to `L:/PLATFORMS/treido-bg-shop`.

Use the inspiration checkout when maintaining a reusable reference. Use each product's own folder and documents when implementing marketplace behavior. This root's general-goods requirements do not govern the three Treido BG builds.

## Historical baseline — September 28, 2026

The copied application has 57 web pages, four reference asset handlers, a retained Expo scaffold, and substantial reference journey coverage. Its home/catalog are intentionally preview-only; account operations and checkout are not a production marketplace backend. Installed packages exist locally, although earlier copy notes predate that installation.

The documentation audit is followed by the first implementation pass: an explicit reference catalog adapter, an allowlisted search projection, isolated card components and a safe preview launcher. CSS and dependency pins are unchanged. Search catalog JSON is 67.2% smaller for the live fixture and 39.5% smaller for the captured fixture; mobile/desktop search screenshots are byte-identical. See [tasks](tasks.md) for verification and resource blockers.

**Current progress:** [tasks](tasks.md) records the catalog/search and product-detail boundaries, September 30 seller presentation and search correction, and the remaining work. T01a frozen-install qualification has since completed. T02a remains blocked by its security gate and unverified hosted run; connected marketplace qualification remains outstanding. Continue from those receipts, not from another planning phase.

## Product direction

One human may buy, have a personal seller account, and belong to multiple businesses. Signup offers Buy, Sell personal items and Set up a business as editable intent. The implemented All/Personal/Businesses control filters public supply through one current-scope pill and its selection sheet, preserving the existing header. Operating a business is a separate authorized seller context. Business sellers can sell used items; personal sellers can sell new items. Warranty and verification are explicit claims.

The owner requested **everything for October 1 morning, Europe/Sofia**: F01–F29 in the [complete feature map](docs/features.md). This includes the 16-root BG/EN catalogue, resale and stocked business variants, messaging/offers, seller-grouped checkout, fulfilment/refunds, four seller plans, business imports, labelled boosts, seven grounded shopping assistants and operating support. [Launch](docs/launch.md) defines the full target and qualification gates; [tasks](tasks.md) gives the executable dependency sequence. The existing Shop-derived UI stays the frontend; product/backend logic is replaced inside this workspace.

Read [platform](platform.md) for the end goal, [journeys](docs/journeys.md) for how people use it, and [tasks](tasks.md) to build the next slice. September 30 planning reconciles the older Astra/Amazong/Treido documents listed in [sources](sources.md); those references do not create another active build.

## Documentation map

| Document | Owns |
|---|---|
| [AGENTS.md](AGENTS.md) | Agent startup, non-negotiable rules and work routing |
| [platform.md](platform.md) / [prd.md](prd.md) | Product purpose / testable requirements and scope |
| [tasks.md](tasks.md) | The only active task queue and completion evidence |
| [refactor.md](refactor.md) | Code-specific migration sequence, risks and rollback |
| [architecture.md](architecture.md) | Module boundaries and actual-to-target structure |
| [styling.md](styling.md) | Visual preservation contract and CSS ownership |
| [UI patterns](docs/ui-patterns.md) / [UI verification](docs/ui-verification.md) | Buyer/Studio component and flow rules / matched-state regression acceptance |
| [Documentation ownership](docs/documentation.md) | Small-context agent routing, current facts and contract checks |
| [October 2 handoff](docs/audit/2026-10-02-design-handoff.md) | Design/doc tooling changes, fresh checks, stack review and remaining gaps |
| [techstack.md](techstack.md) | Stack choices, dated version audit and upgrade policy |
| [docs/frontend.md](docs/frontend.md) / [docs/caching.md](docs/caching.md) | React/Next implementation and cache rules |
| [docs/marketplace.md](docs/marketplace.md) / [docs/backend.md](docs/backend.md) | Seller model, listing/search/offer invariants / server execution |
| [docs/features.md](docs/features.md) / [docs/journeys.md](docs/journeys.md) | Complete feature coverage / signup, selling, shopping and operating flows |
| [docs/categories.md](docs/categories.md) | Versioned roots/leaves, BG/EN labels, typed attributes and exposure policy |
| [docs/data-model.md](docs/data-model.md) / [docs/api.md](docs/api.md) | Target schema/constraints / queries, commands and HTTP boundaries |
| [billing.md](billing.md) / [docs/promotions.md](docs/promotions.md) | Recommended plans/fees, qualified payment rules / boosts and sponsored selection |
| [docs/assistants.md](docs/assistants.md) | Useful Minis, tool grounding, model budgets, privacy and evaluations |
| [docs/launch.md](docs/launch.md) | Full October 1 target, dependency lanes, supply and release gates |
| [docs/testing.md](docs/testing.md) / [docs/operations.md](docs/operations.md) | Verification / environments, reliability and release gates |
| [docs/decisions.md](docs/decisions.md) / [docs/ai-workflow.md](docs/ai-workflow.md) | Decisions / small-task and handoff practice |
| [sources.md](sources.md) | Source provenance and primary research references |
| [September 30 planning evidence](docs/audit/2026-09-30-global-planning.md) | Recovered older docs, observed runtime and documentation verification scope |

`PROJECT.md` and `design.md` are compatibility entry points, not extra specifications. Copied donor documentation under `app/` is historical reference. The product-root files above own current behavior.

## Commands

Commands run from `app/` with the **current** pinned Node `24.20.0` and pnpm `12.3.4`. Recheck `node --version` and `pnpm --version`: the default shell reported different versions during audit.

```sh
pnpm install --frozen-lockfile
pnpm test:unit
pnpm --filter @treido/web exec eslint src --max-warnings=0
pnpm --filter @treido/web typecheck
pnpm build:web
```

These are existing commands, not a statement that each was executed this pass. Fresh install is a T01 reproducibility check, not necessary to read the docs. Avoid `pnpm format` across the inherited app during a focused task. The current `pnpm check` also includes native/workspace work and repository-wide formatting; see [testing](docs/testing.md).

**Local preview:** `pnpm dev:web` now binds loopback port 6418 and `.qa/treido-preview`. Set `TREIDO_PREVIEW_PORT` for another free non-donor port. Occupied ports are not reused; hosted/production environments are refused. `pnpm test:tooling` checks this contract. Free disk/memory before starting additional servers. Native reference 5560 was not compared in this implementation pass.
