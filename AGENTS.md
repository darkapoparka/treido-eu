# Treido — agent contract

## Final product selection

The October 1 decision selects this Global app and `L:/PLATFORMS/treido-bg-shop` for Foods. BG Wolt/BG Next and the older Treido/Amazong trees are preserved donors. Do not restart a source election, clone another app or apply their old task queues.

Use [platform](platform.md), D23–D25 in [decisions](docs/decisions.md), and the named product adaptations in [styling](styling.md). A pure refactor retains matched appearance. A task implementing those documented adaptations may change its specific region without treating full native Shop parity as a prerequisite. A documentation-only task does not itself implement UI changes; a later implementation request executes the named ready slice.


## Mission and authority

Build Treido: a Bulgaria-first, general physical-goods marketplace for personal and business sellers, with a path to international expansion. This is **not Treido Foods**. Preserve the copied Shop frontend's styling and behavior while replacing reference-only logic with real marketplace capabilities.

Canonical Git/docs root: `L:/PLATFORMS/treido-eu-global`. Package workspace: `app/`. Web: `app/apps/web`. Intended repository: `darkapoparka/treido-eu`. The owner authorized this physical relocation on September 30; ordinary product work must not clone, move, flatten or create another implementation. The Shop source at `L:/inspiration/shop-app` and older projects are read-only references for product work. The active Foods product is `L:/PLATFORMS/treido-bg-shop`; `treido-bg-wolt` and `treido-bg-next` are preserved donors. Old CODEX paths are temporary session compatibility links pending T20 retirement, not current project roots. Confirm `git status` and remotes before writing. At the final September 28 check, `origin` points to `darkapoparka/treido-eu`; preserve that connection and never push to the donor.

The current user request and these product-root contracts govern Treido. Nested instructions add implementation details; they must not restore donor food requirements, donor ports, a full-Shop-clone gate, or old work queues. `app/` reference documents retain historical evidence, not competing product authority. Preserve the generated Next.js block in the web AGENTS file.

## Start each task

1. Read this file, the relevant current claim/receipt and executable row in [tasks.md](tasks.md), and the task's named documents. Do not load the entire historical receipt archive for a small change.
2. Inspect the actual implementation, package scripts, local changes and relevant tests. Explain the intended change and identify the smallest useful slice.
3. Use the relevant existing task and identify the affected files. Record a claim only when work overlaps another active writer; independent edits need no claim ceremony. Preserve unrelated changes and serialize shared Git/build operations.
4. Implement, run appropriate checks, inspect the diff, and update the same task with evidence and the next step. A later “continue/build” request authorizes the next ready local task; do not start another planning cycle.

## Non-negotiable boundaries

- **Visual lock:** [styling.md](styling.md) is authoritative. No theme/framework swap, default font replacement, generic marketplace redesign, global spacing cleanup, screenshot backgrounds, or automatic baseline refresh. Logic-only work must not alter visual output. The existing public seller-scope pill and approved Studio adaptations do not authorize redesigning surrounding chrome.
- **Two different scopes:** browsing `seller=personal|business` filters public supply. Operating `sellerId` chooses a seller account and requires current authorization. Neither changes the other. Seller type, condition, verification, commercial warranty and subscription are separate facts.
- **Server authority:** validate untrusted input, authenticate, authorize the specific resource and current seller membership, then execute the use case. Never trust a browser role, price, quota, payment success, stock count or selected business ID.
- **No fake production:** reference fixtures remain opt-in and isolated. A database/provider failure never falls back to sample success. Do not remove preview guards until the replacement route has a real adapter and boundary tests.
- **Small modules:** retain the existing Next workspace. Server Components by default, small client interaction islands, narrow view models, feature-owned code. Do not create a universal service framework, generic repository hierarchy, or new workspace for a single helper.
- **Money and races:** integer minor units plus currency; immutable accepted terms; atomic quota/allocation checks; idempotent provider effects. Browser countdowns and redirects are not authority.

## Visual surfaces and documentation routing

Shop buyer UI and Shopify-derived Studio are separate scoped systems. Preserve both; do not spread Studio fonts/density across buyer or direct Sell/auth screens. Current `/admin-preview` is a fictional device-local UI with production guards; private `/app` needs current resource/seller authority and real adapters. Use the approved Treido copy/artwork exceptions, not blanket pixel-identity claims. Scoped discovery/sellers AGENTS route to their pattern owners. [Documentation ownership](docs/documentation.md) explains which facts to update without creating another queue.

## Read by work type

| Task | Read next |
|---|---|
| UI, CSS, component extraction | [styling](styling.md), relevant [UI pattern](docs/ui-patterns.md), [UI verification](docs/ui-verification.md), [frontend](docs/frontend.md) |
| Studio/admin or private seller integration | STU patterns above, [seller workspace](docs/seller-workspace.md), [backend](docs/backend.md); preview behavior is not real provider evidence |
| Server boundaries, routing, cache | [architecture](architecture.md), [caching](docs/caching.md) |
| Identity, selling, search, messaging | [PRD](prd.md), [journeys](docs/journeys.md), [marketplace](docs/marketplace.md), [backend](docs/backend.md) |
| Categories, stock, imports | [categories](docs/categories.md), [data model](docs/data-model.md), [API](docs/api.md), task's journey |
| Payments, plans, entitlements, boosts | [billing](billing.md), [promotions](docs/promotions.md), [backend](docs/backend.md), [operations](docs/operations.md) |
| Minis, AI, alerts | [assistants](docs/assistants.md), [API](docs/api.md), [testing](docs/testing.md) |
| Full launch / supply | [features](docs/features.md), [launch](docs/launch.md), [operations](docs/operations.md) |
| Dependencies or build tooling | [techstack](techstack.md), [audit](docs/audit/2026-09-28.md), [refactor](refactor.md) |
| Handoff or parallel work | [AI workflow](docs/ai-workflow.md) |

Repository skills live in `.agents/skills/`: `treido-nextjs`, `treido-visual-parity`, `treido-backend`, `treido-task`. Read the relevant `SKILL.md`; a launcher that does not discover skills can follow those files manually. Skills are workflows, not duplicated specifications or proof of model capability.

## Commands and evidence

Run package commands from `app/`, not the Git root. Use the manifest's pinned Node/pnpm; see [testing](docs/testing.md) for existing commands and their scope. `pnpm dev:web` uses loopback port 6418 and `.qa/treido-preview`; `TREIDO_PREVIEW_PORT` selects another free non-donor port. The launcher refuses hosted/production environments. Check resource headroom before starting it; T01 install/build qualification remains separate. Never stop another project's preview.

The assigned source reference is `emulator-5560`; it was offline during this audit. Always specify that serial for any later ADB action. Do not switch to another emulator, reset account state, reinstall apps, or claim screenshots were compared without actual evidence.

Before completion: relevant tests, changed-route checks, diff review, and matched-state visual comparison for rendered changes. Record commands, outcomes, limitations and evidence paths. A green unit suite is not visual approval, backend integration, security certification or production readiness. Do not weaken checks, hide failures, or mark blocked verification as passed.

## Safety and scope

No destructive Git operations, broad formatting, unrelated edits, secret copying, credential logging, or automatic package upgrades. Do not run legacy one-shot import/patch scripts. Do not commit/push, provision paid services, change shared/production data, deploy, activate payments, or publish captured media without a specifically authorized task. Preserve source provenance and check publication rights before synchronizing the public repository.

Keep progress in `tasks.md` only. Stable rules belong in their owning document; implementation decisions in `docs/decisions.md`; raw evidence under a dated audit or local artifact directory. Update docs when behavior changes, not as a replacement for implementation. “Perfect” is an aspiration; report only what was actually verified.
