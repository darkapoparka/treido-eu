# Treido

A new food-first marketplace, full merchant operating dashboard, personal/business accounts, administration and native buyer app. Start in Bulgaria with Bulgarian and English; model additional markets explicitly.

**Current state: the Shop-matched mobile website is being implemented in `apps/web` on `main`, under the owner's expanded Tasks 3/5/6 frontend assignment. The full frozen source contains 323 screens and 97 flows. Discovery, account and commerce UI use an explicitly enabled local reference fixture. Source parity and real commerce are not yet complete. Expo remains outside this website assignment.**

Work directly on `main` for subsequent tasks, per the owner's instruction. [tasks.md](tasks.md) records the current checkpoint; [design.md](design.md) records the frozen source inventory and 97-flow implementation map; [product.md](product.md) section 5 contains the catalog and commerce proposals. No product provider integration or production readiness is claimed.

## How to start

Use Node 24.20.0 and pnpm 12.3.4, run `pnpm install --frozen-lockfile`, then `pnpm dev:web` (port 3100) or `pnpm dev:mobile` (port 8081). [techstack.md](techstack.md) records setup, checks and native limitations.

Continue the current website assignment with **Continue Task 3**. The owner has authorized building the mapped frontend slices ahead of backend implementation. [tasks.md](tasks.md) records actual progress and remaining work; source approval is separate.

For the isolated website preview, acquire the 55 recorded public product originals with `node prepare-shop-reference.mjs` (the store video frame requires FFmpeg on PATH or `FFMPEG_PATH`). `node prepare-shop-reference.mjs --verify` checks existing files against the provenance manifest. The existing owner-requested gallery in `references/shop` supplies the remaining decorative/photo crops; this assignment preserves that earlier reference copy. Newly acquired originals stay ignored and acquisition fails if a source changes. In PowerShell, set `$env:SHOP_REFERENCE_PREVIEW='1'`, then run `pnpm --filter @treido/web exec next dev --hostname 127.0.0.1 --port 3101`. The normal unconfigured website and reference-media endpoints return 404 until the real catalog is connected; there is no automatic fixture fallback. `VERCEL_ENV=production` rejects fixture access even if the preview flag is set.

After a production build, `pnpm test:smoke:web` checks that boundary on port 3102. `pnpm exec playwright test --config playwright.reference.config.ts` runs the opt-in frontend journeys on port 3103 with local media. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome. Do not run a production build beside a dev server using the same `.next` directory.

Tasks are meaningful work packages, not individual file edits. The agent implements a batch before running its closing checks; the full product regression is a later numbered task. No extra long prompt or separate task-code lookup is needed.

## Documentation

| File | Responsibility |
| --- | --- |
| [product.md](product.md) | What Treido does: users, features, business rules and open commercial decisions. |
| [design.md](design.md) | Exact Shop UI/flow reference, review and subsequent Treido adaptation. |
| [tasks.md](tasks.md) | Numbered executable work packages and the only progress record. |
| [AGENTS.md](AGENTS.md) | How the agent executes tasks, uses skills/CLIs and reports batch results. |
| [techstack.md](techstack.md) | Selected tools, compatibility, setup and scripts. |
| [architecture.md](architecture.md) | Code/data ownership, API, permissions, transactions and rendering. |
| [verification.md](verification.md) | Batch checks, focused risk tests, final regression and release proof. |

Do not add a duplicate features.md, requirements.md or another backlog. product.md is the feature authority; each numbered task points to the applicable sections.

## Selected foundation

A small pnpm/Turborepo monorepo: `apps/web` uses Next.js for the complete browser platform and server/API; `apps/mobile` uses Expo/React Native for the native buyer app. Shopping, accounts, the full selling dashboard and administration have distinct layouts and permissions. Native uses the same commerce backend. Client-safe contracts/tokens can be shared; database/server code and platform UI are not shared into native.

Start with official framework CLIs and use relevant available skills/plugins. Do not install the full next-forge scaffold or reopen the stack decision during routine work.

## Build order

Task 1 installs the foundation. Task 2 establishes the source and product details. Task 3 starts reproducing Shop's buyer discovery UI immediately, without waiting for the backend. Tasks 4-6 add real data, purchases and the remaining reference flows. After explicit source approval, Task 7 applies Treido branding and food content. Tasks 8-11 complete the remaining merchant/platform features; Tasks 12-14 verify and release the product under explicit authorization.

This is one implementation developed in batches, not a screenshot clone followed by a replacement frontend. Isolated fixtures support design work; they are not proof of working commerce.

## Clean build and safety

Build from this specification. Old repositories are optional references, not mandatory migration/parity targets or required component/schema imports. Existing systems must not be changed as a side effect. Real-data import or domain takeover requires separate scope and authorization.

The repository is public. Never commit secrets, customer data, authentication recordings, private logs, signed URLs or restricted screenshot/font collections. Use fresh isolated development data and safe reference storage. Installation does not authorize paid infrastructure, live payments, production deployment or store submission.

Task 1 has local evidence recorded in tasks.md. Hosted CI and native installed-device behavior have not been verified. No task is completed merely because it is documented.
