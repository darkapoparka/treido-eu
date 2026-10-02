<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Treido web scope

Read [root AGENTS](../../../AGENTS.md), [tasks](../../../tasks.md) and the relevant [frontend](../../../docs/frontend.md), [architecture](../../../architecture.md) or [backend](../../../docs/backend.md) contract. Preserve the framework-generated block above; it does not independently authorize a Git commit.

Keep [styling](../../../styling.md) 1:1 for refactors. Existing CSS, components, sheets, navigation and typography remain the visual source. Product-root docs override historical Shop/Foods context inside this workspace.

Server Components by default; small client interaction islands; narrow serializable view models; `server-only` data and current resource/seller authorization. Do not ship the full reference catalog as product data. `cacheComponents` is currently off; follow [caching](../../../docs/caching.md) before introducing cache APIs. Browser state, selected business, plan labels and redirects are not authority.

Tests and preview commands come from [testing](../../../docs/testing.md). Do not start donor port6412 or reuse another Next process's output. Retain reference isolation while introducing real adapters. Matched-state visual evidence is required for rendered changes; unit/build success alone is insufficient.

## Surface-specific guidance

Buyer work follows [UI patterns](../../../docs/ui-patterns.md) BUY sections and `src/features/discovery/AGENTS.md`; Studio follows STU sections and `src/features/sellers/AGENTS.md`. Preserve scoped fonts/CSS and direct Sell/auth appearance. [UI verification](../../../docs/ui-verification.md) requires actual loaded content, matched states and honest source/preview/provider labels. A local mock order/refund or two-store switch is not real database isolation. [Documentation ownership](../../../docs/documentation.md) governs contract updates; keep the generated framework block above unchanged.
