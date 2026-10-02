# Seller Studio and private seller scope

Follow [root AGENTS](../../../../../../AGENTS.md), the named [task](../../../../../../tasks.md), [seller workspace](../../../../../../docs/seller-workspace.md), STU patterns in [UI patterns](../../../../../../docs/ui-patterns.md) and [UI verification](../../../../../../docs/ui-verification.md). Use [backend](../../../../../../docs/backend.md) for real adapters/actions.

Preserve the scoped Shopify-derived shell, Inter metrics, compact tables/fields, cards, phone drawer, global search and Sell Helper. Maintain approved Treido art, compact phone copy and main-site/store exits. Do not leak merchant styles into buyer or direct Sell/auth screens; do not invent a new dashboard theme.

`preview/` is a guarded device-local fictional frontend. Its account selector, local saves, roles, refunds, orders and Mini tools are not production authority or proof of integration. Never import preview context as a fallback into private queries. Real `/app` authenticates and checks current human/seller/resource authority on every read and command.

One human can operate a personal seller and several businesses. Revalidate a selected seller, reject old-context responses, scope/clear private buffers, preserve recoverable unsaved input and deny foreign/revoked IDs. A public browse filter, paid plan or completed checklist cannot grant these rights. Mock two-store isolation is not a database authorization test.

Wire real feature contracts behind accepted presentation one route at a time; retain explicit unavailable/denied/conflict states. Keep commands revision-aware and idempotent; no GET-created drafts or client-confirmed money/publication. Separate rendered parity, local interactions, database evidence and live provider acceptance in the existing task receipt. New/touched merchant copy needs BG/EN; existing translation gaps remain visible until resolved.
