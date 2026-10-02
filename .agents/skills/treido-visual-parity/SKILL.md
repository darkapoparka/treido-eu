---
name: treido-visual-parity
description: Use when a Treido task changes markup, CSS, components, fonts, assets, motion or stateful navigation. Protects the distinct Shop buyer and Shopify-derived Studio systems; does not authorize a redesign.
---
# Treido visual-preservation workflow

1. Read root `styling.md`, active task, the relevant BUY/STU pattern in `docs/ui-patterns.md`, and `docs/ui-verification.md`. Identify actual component/CSS owners; buyer, direct Sell/auth and Studio are distinct style boundaries.
2. Separate pure refactor from approved visible product change. Record exact allowed differences before editing. The personal/business control does not authorize changing the surrounding header.
3. Establish matched route/query, fixture/store, language, viewport/height/DPR, browser/OS, text scale, loaded content/fonts/images, scroll and overlay state. A skeleton or empty image array is not readiness. Record source-observed versus accepted Treido baseline; keep 393×793 and affected breakpoint/desktop checks. Never invent native or signed-in source evidence.
4. Preserve DOM geometry, class specificity/order, typography, icons/crops, safe areas, focus, Back and scroll restoration. Extract one responsibility; avoid global overrides or theme replacement.
5. Run the same journey and compare before/after. Inspect diffs; do not automatically update baselines, mask changed content or raise tolerance to pass.
6. Check keyboard, long Bulgarian/English copy, narrow layout, loading/error states and console/hydration. Use emulator5560 only when online and explicitly in scope.
7. Record evidence and any bounded approved exception in `tasks.md`. Unverified required parity remains blocked, not passed.

No StyleX migration, default font substitution, generic marketplace cards, screenshot backgrounds, global spacing normalization or donor edits.

Preserve approved Treido artwork and compact phone copy. Global search and seller Mini are different flows. Separate visual fidelity, preservation, local behavior and real authorization/provider evidence; 168 local layout observations do not mean 168 source comparisons. Follow the latest owning receipt rather than treating dated captures as current proof.
