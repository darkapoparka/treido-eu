# Treido Global

A general-goods marketplace: people and businesses publish listings, maintain seller profiles/storefronts, and buyers discover products, follow sellers, save items, message and buy. This is not the Bulgarian food-producer product.

## Verified source copy — 27 September 2026

**Application source now exists:** `L:/CODEX/platforms/treido/app`. Main web owner: `app/apps/web`. No need to copy or scaffold again.

Original reference retained unchanged: `L:\CODEX\treido-bg`, branch `main`, HEAD `7ab4dd99c535f88806b63ef2457e203021253cc9`. 7,775 copied files / 715,450,113 bytes passed SHA256 verification; relevant working-tree changes were copied. Full donor Git history remains at the original reference; no donor .git/remote is installed inside app.

This is a source baseline, **not a boot-tested or product-complete application**. No dependency install, UI adaptation, database work or deployment was performed. Required workspace/lockfiles, public assets and source reference contracts were retained. Donor private environments, generated caches, browser-state QA and source automation remain at the original location and were not activated in the derivative.

Manifest: [source-copy verification](../_organization/2026-09-27-finalize-185118/treido-source-copy.json).

## Frontend and product authority

Use the copied Shop frontend as the visual/code baseline. Keep its actual typography, spacing, components, overlays and navigation; adapt home shelves to seller profiles with products. Do not import another styling system or replace the UI with generic marketplace cards.

Foods-specific rules in copied donor documents are historical source context, not Global requirements. Obqvi remains preserved overlapping domain knowledge, not a second active general-marketplace queue.

The product-level [PRD](prd.md), [architecture](architecture.md), [design](design.md) and [billing](billing.md) own the intended product. Documents copied inside app describe the donor/reference unless explicitly adapted. Product docs and future Git root are `L:/CODEX/platforms/treido`; application code is below app. Never push to the donor by accident.

## Agent startup

Read [AGENTS](AGENTS.md) and the current [task](tasks.md), then only its relevant PRD and component files. Boot the copied workspace on an available non-donor port, record matched home/search/store/product/cart states, then implement seller-led shelves and listing/publishing/message contracts using the existing components.

6414 is a proposed separate preview port, not started or reserved; inspect listeners first. The inherited web dev script names donor port 6412 and must not be run unchanged. Keep the source preview and all unassigned emulators untouched. Commands and toolchain pins must come from the copied package.json and lockfile; no install/build outcome is inferred from copying.

The organization session stops before implementation. When the owner says build or continue this product, execute the next task here; do not repeat the portfolio audit, make another copy, or wait for another documentation phase.

