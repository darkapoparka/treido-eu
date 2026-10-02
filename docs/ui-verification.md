# UI acceptance and anti-regression protocol

This is the acceptance procedure for [UI patterns](ui-patterns.md), governed by [styling](../styling.md). [Testing](testing.md) owns runnable commands and domain coverage. [Tasks](../tasks.md) alone records current PASS/FAIL/BLOCKED/NOT RUN evidence. No document or test suite promises that regressions can never occur; the purpose is to expose them before acceptance and make recovery precise.

## Four independent claims

| Claim | Required evidence | Does not prove |
|---|---|---|
| Reference fidelity | Matched source/implementation state, inspected differences and bounded approved exceptions | Every unobserved source screen, native equivalence or functionality |
| Preservation | Before/after accepted Treido state, unchanged regions compared and relevant interactions exercised | Original source parity when the starting implementation was already different |
| Product behavior | Real stateful journey, failures/recovery, persistence and permission checks | Payment/provider qualification or visual parity |
| Release readiness | Isolated provider/database/security/asset/deployment/restore evidence in owning tasks | A future regression-free guarantee |

Use explicit labels: SOURCE-OBSERVED, TREIDO-ADAPTATION, PRESERVATION-VERIFIED, UNVERIFIED. A source-inspired guess is not SOURCE-OBSERVED. A screenshot comparison with the same defect on both sides is not a usability pass. A reference-denial 404 smoke test is not a working production Home.

## Baseline record before editing

Record task/pattern IDs, source path or URL and capture timestamp, exact Git commit plus dirty-file hashes, route/query, fixture/store/seller, language, browser/version/OS, viewport/height/DPR, zoom/text scale, fonts, media readiness, scroll container/offset and open menus/dialogs. Reference account data stays private; sanitize shared receipts. Authentication state may be described, never export credentials or session cookies.

Record the permitted difference before touching code: pure extraction, original Treido branding, new marketplace field, approved copy change, or bounded accessibility correction. Save before-images and relevant geometry/computed-style facts. Source evidence and accepted Treido baselines are different records. Do not overwrite either just because a new diff fails.

Wait for actual content, hydration, fonts and visible images—not merely HTTP 200, a main element, an empty image array or DOMContentLoaded. A loading skeleton is a separate test state. Screenshot tooling can temporarily alter caret styles; avoid capturing mid-hydration and investigate resulting console noise rather than attributing it automatically to app code. Use a clean retry without capture to distinguish harness artifacts from reproducible defects.

For preservation use the same browser/OS/DPR. Cross-platform font antialiasing can differ; inspect evidence instead of applying blanket tolerance. Mask only documented nondeterministic content, never the component under test. Geometry, typography, crop, hit targets and interaction remain acceptance criteria even when pixel similarity is high.

## State coverage, not just route coverage

A route visited at four widths is four layout observations, not four verified source flows. For each changed pattern, test its affected states and at least one adjacent unchanged surface.

| Pattern / flow | Minimum changed-state acceptance |
|---|---|
| BUY-01 discovery/scope | All/Personal/Businesses; checked sheet row; dismiss/cancel; query/filter preservation; direct URL/reload/Back; empty/error/racing responses; operating seller unchanged |
| BUY-02 card/detail | Consistent same-family cards; long titles; missing optional facts; save/gallery/variants; removed/sold/restricted states; detail → seller → Back retains context |
| BUY-03 seller | Personal and business presentation, neutral fallback, collection/search/review return, correctly scoped search chrome, no captured identity leakage |
| BUY-04 sheets/cart/account | Applied versus draft state; Escape/backdrop/focus; keyboard/safe areas; retained input on error; honest checkout simulation versus actual authority |
| STU-01 navigation/exits | Expanded/collapsed desktop, phone drawer, Settings menu, keyboard/Back/scroll, current-store preview, buyer return, store/language preserved |
| STU-02 Home | Empty/setup/dismiss/restore, loaded original artwork, compact 320px welcome/plan, long store name, 200% text, unchanged desktop composition |
| STU-03 search/Mini | Idle/query/empty/results; arrow/Enter/one Escape; search versus assistant; full/side/expanded states; recents scoped to seller; unavailable tools honest |
| STU-04 lists/editor | Empty/populated, search/sort/tabs/pagination/selection, revision conflict, pending/error/retry, long labels, media failure, foreign/revoked resources denied |
| Shared language/theme | BG/EN, 320/390/393 and 1024/1440/1920; affected breakpoint boundaries; focus/reduced motion; no buyer/Studio CSS or font leakage |

Use the existing 393×793 reference viewport; record desktop height rather than saying only 1440. Check 767/768 for shell changes and the relevant 900/1000/1050 boundaries for content changes. For a localized component test long BG/EN at 320px and 200% text. The entire matrix is not mandatory for a typo in a non-rendered document, but shared CSS/font/navigation changes require broad related-surface coverage.

## Personal/business acceptance must cross UI and server

Use two humans, one personal seller and two businesses, including a revoked member. Test personal-new and business-used listings so seller kind cannot become a condition proxy. Combine scope with category/condition/location and ensure canonical URLs, counts, facets, pagination and public eligibility agree. A scope pill cannot authorize a private read or command.

Switch operating sellers while a read/save is delayed: old results and local private buffers cannot populate the new seller. Direct foreign IDs, stale permissions, logout/reload, remembered seller hints and forged capability/paid flags fail closed. Private views must not reuse cross-tenant caches. Do not treat fictional Studio/Personal isolation in local storage as proof of this database boundary.

## What is covered today versus still open

T30b–T30g record substantial merchant source inspection and local responsive/interaction evidence, including 703 unit tests / 56 files at T30g. Those dated results are not rerun by reading this file. The 168 local route/layout observations recorded under T30e are not 168 source comparisons. General Settings was source-inspected; the remaining Settings, populated source scenarios, product-editor details, Growth and Markets have open parity work. Approved phone copy, Treido artwork and marketplace-specific capabilities intentionally differ.

The T31 audit is a fresh bounded local spot-check and documentation verification, not an exhaustive signed-in Shopify audit. Native Shop emulator-5560 was unavailable during this pass. Historical source captures are identified as historical. Do not silently switch to another emulator or assume another agent's authenticated browser is available. Full source fidelity remains open until matched evidence closes the named gaps.

Existing Playwright reference and unit suites, product-mode denial checks and database/provider tests serve different purposes. The current CI does not automatically compare all buyer/Studio screenshots or exercise every merchant flow. Add deterministic tests as each owning task becomes reproducible; do not install a broad baseline-update shortcut or relabel local manual sweeps as hosted CI coverage.

## Completion receipt and recovery

Each rendered task records: pattern IDs; allowed differences; before/source/after evidence; route and state matrix; exact command/results; console/font/image checks; preserved adjacent regions; unresolved gaps; one next action. Label each required check PASS, FAIL, NOT RUN or BLOCKED. A blocked mandatory check prevents DONE for that acceptance scope. Small optional observations must not hide a failed required journey.

Review diffs before accepting: DOM/cascade drift, new global selectors, arbitrary spacing, fonts, missing states, narrowed tests, reference leakage, authority inferred from UI, broad private caches and provider errors disguised as success. Never silence hydration/security errors or raise screenshot tolerance to obtain green checks.

For a regression, identify the owning change and retained before-state. Stop only the conflicting work, reproduce the exact failing state and make a focused repair or reviewed patch reversal. Preserve unrelated dirty edits. Do not reset the repository, restart other agents' servers, replace their lockfiles or regenerate all baselines. Re-run the failed case and related surfaces, then update the same task receipt.

Documentation changes run the product-document validator and its tests, inspect owned diffs and verify runtime fingerprints. They do not require a type-generation/build process that mutates files owned by the active preview. Application changes still run the proportionate gates in [testing](testing.md); documentation validation cannot replace them.
