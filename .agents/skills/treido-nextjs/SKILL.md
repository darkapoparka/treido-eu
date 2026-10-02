---
name: treido-nextjs
description: Use for Treido Next.js routing, Server/Client boundaries, data fetching, actions, cache changes or framework upgrades. Not a general UI redesign or native workflow.
---
# Treido Next.js workflow

1. Read root `AGENTS.md`, the active task, `architecture.md`, and the relevant section of `docs/frontend.md` or `docs/caching.md`.
2. Inspect actual manifest/installed Next guidance and current route imports. Distinguish existing behavior from a proposed configuration; Cache Components is not enabled by default here.
3. Keep route composition server-first; isolate only needed interaction. Pass a narrow view model, not private rows or the entire catalog. Use server-only modules and per-resource authorization.
4. For a mutation name its validation, permission, transaction, retry and invalidation behavior before editing. For a cached query name its full key, permitted stale data and removal path.
5. Preserve reference guards and the visual output. Never solve a missing backend by removing preview gating or returning fixtures after a provider failure.
6. Run relevant tests/typecheck/build and changed-route verification. Check a negative authorization/reference case, not only the happy path. Rendered changes also use `treido-visual-parity`.
7. Record actual evidence in root `tasks.md`. Do not claim unsupported API compatibility, a whole client-bundle reduction or production readiness without measurements.

No universal service layer, new workspace, blanket `use client`, blind latest upgrade, broad shared private cache, or SSR self-HTTP fetch as a shortcut.

When integrating Studio, read `docs/ui-patterns.md` and `docs/seller-workspace.md`: retain accepted presentation while supplying narrow authorized view contracts. `/admin-preview` state must not become a private `/app` fallback. Read the current `techstack.md` snapshot and advisories for upgrades; preserve the generated web AGENTS block, active runner files and exact lockfile unless the named task owns them.
