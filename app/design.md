> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Design authority and reconstruction

## Frozen buyer source

The selected Shop iOS capture is `7b6adbde-de48-47c5-979b-f629f1eb87a9` for app `shop-ios-1f1a3d5b-cb65-4c7e-af4b-e4cdf1c03e4d`. [Source catalogue](https://mobbin.com/apps/shop-ios-1f1a3d5b-cb65-4c7e-af4b-e4cdf1c03e4d/7b6adbde-de48-47c5-979b-f629f1eb87a9/screens).

The existing [reference manifest](references/shop/manifest.json) contains **97 flows, 424 ordered flow frames and 323 standalone media entries**. These are different inventories. Preserve source IDs, original files, sequence order and recordings; do not replace the capture because a newer app version exists.

[shop-parity-checklist.md](shop-parity-checklist.md) owns flow acceptance. [shop-frame-ledger.md](shop-frame-ledger.md) is the dated frame measurement record. [shop-implementation-map.md](shop-implementation-map.md) owns execution/evidence mapping. Routes, executable recipes, captures, numerical candidates and owner acceptance must be reported separately.

## Comparison contract

For the documented 1179/1180 x 2676 flow rasters, normalize the REFERENCE to 393 x 892, then crop `(0, 59, 393, 793)`. Capture live browser content at **393 x 793**, without resizing it. This removes native status chrome and the Mobbin footer, not application pixels. Do not apply that crop blindly to standalone media of other dimensions.

System keyboard/provider chrome exceptions require per-frame evidence. Never mask wrong imagery, typography, missing content or app-owned controls. Do not paint an iOS status bar or full screenshot into a web page. Record platform/browser/device/viewport, font and asset availability, source frame, fixture and commit.

Use the existing replay and scoring tools. The diagnostic thresholds are MAE <= 1.5% and bad-pixel-12 <= 8%; a shared-change MAE increase above 0.15 points needs investigation. These are diagnostics, not permission to waive meaningful visual or interaction differences. Do not loosen thresholds, alter source hashes or auto-approve baselines to raise progress.

## Implementation contract

Inspect complete ordered source sequences before implementing a family. Build real pages, shared components, typed state and usable controls, including transitions, Back/Forward, parent/child overlays, focus return, scroll and keyboard behavior. Replay actual interactions rather than teleporting every screen through unrelated state injection. Named fixture entry points may establish documented source histories that are genuinely disconnected.

Use source typography, dimensions, palette, content and lawful assets during comparison. Any unavailable font/asset or OS behavior is a named exception requiring review, not an invented claim of pixel identity. Source assets are reference/media inputs, never the whole interface.

Current execution is mobile-width buyer web. Check relevant 320/430 containment; design tablet/desktop compositions deliberately. Android/native/system differences need their own evidence. Screen recordings are obligations for motion review; matching a still does not verify timing or gestures.

## Source approval, then Treido adaptation

During construction, extract shared measured patterns into [style-guide.md](style-guide.md) and their real code owners. The owner/design reviewer approves the declared source scope and exceptions. Source approval and production-service verification are independent gates; neither substitutes for the other.

Only after source approval, adapt the SAME components to manufacturer identity, food-specific information, taxonomy, units, fulfillment and approved Treido branding. Keep a change/disposition map for reference-specific features. Do not create a throwaway Shop clone, permanent dual skins or a generic shopping replacement.

## Seller and admin sources

[app.md](app.md) defines the seller/CMS product. The exact Shopify web capture in [shopify/README.md](shopify/README.md) is selected but NOT downloaded or visually verified. A Shopify screenshot collection is a UI reference, not Shopify's backend implementation. Platform administration has its own [contract](admin.md).

Original detailed source observations and prior checkpoints are preserved in [history](docs/history/README.md); read a precise dated section only when needed. Older status, viewport proposals and execution modes in that archive do not override this document.
