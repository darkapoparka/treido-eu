<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Treido Global web scope

Read [application AGENTS](../../AGENTS.md), [product README](../../../README.md), [current task](../../../tasks.md) and the relevant [product PRD](../../../prd.md). This is the general-goods marketplace, not Treido Foods. Buyer/seller/admin web surfaces stay in the existing app where the product architecture assigns them.

Preserve the original Shop components, type/spacing/layout system, stateful navigation and maintained reference checks. Use seller profiles and general listings rather than food-only producer/basket rules. Copied web.md/app.md/admin.md describe donor context and do not override the product root.

Keep the generated framework block above. Use installed-version Next guidance, server-only data/authorization, focused tests and matched-state comparisons. Do not start the source port 6412 or claim its emulator. Organization has not installed or boot-tested this copy.
