# Treido application workspace

The Git/product root is one directory above this workspace. Read [root AGENTS](../AGENTS.md), [tasks](../tasks.md) and the named task's documents. This is the general-goods Treido project, not Foods and not another Shop clone queue.

Run package commands here using the pinned toolchain. Web lives in `apps/web`, retained native in `apps/mobile`, safe shared contracts in `packages/contracts`. Do not flatten the workspace, create another server app or copy donor environment files. The final audit verified `origin` as `darkapoparka/treido-eu`; recheck the target before any future authorized Git synchronization.

Preserve [styling](../styling.md). Copied app-level product/design/backend docs are historical evidence; product-root documents own current requirements. Never follow an old donor path, port6412, food rule or full-parity gate as an active task. Do not run legacy patch/import scripts blindly.

Use [testing](../docs/testing.md) for actual command scope. `dev:web` now owns loopback port 6418 and `.qa/treido-preview`, with an explicit `TREIDO_PREVIEW_PORT` override. Do not start extra processes without free disk/memory; T01 qualification is still tracked at the root. Use only owned preview outputs/processes and specifically assigned emulator5560. Production cannot expose reference fixtures, captured identities, simulated payments or reference assets merely by removing guards.

Repository skills are at `../.agents/skills/`; use the workflow relevant to the task. Update only the root `tasks.md` for status. Nested scope rules supplement, not duplicate, the root contract.

## Design and documentation checks

[UI patterns](../docs/ui-patterns.md) separates Shop buyer and Shopify-derived Studio ownership. [UI verification](../docs/ui-verification.md) distinguishes source parity, local behavior and integration evidence. Keep private `/app` and fictional `/admin-preview` data boundaries intact. For documentation changes run `node scripts/check-product-docs.mjs` and `node --test scripts/check-product-docs.test.mjs` here; these do not replace application checks or authorize type generation on the active preview.
