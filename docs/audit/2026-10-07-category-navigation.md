# Category navigation correction — October 7, 2026

The owner requested shorter mobile category names, Garden separate from Tools/DIY, a useful marketplace hierarchy, clear seller-filter placement and generated artwork. This local T07a/T40/T23c implementation follows that request and D33. The [Shop source audit](2026-10-07-shop-explore.md) remains the comparison reference; this is a bounded product adaptation, not complete native Shop parity.

## Cause and resulting behavior

The immutable publication catalogue's full semantic labels and flat root-to-leaf structure were being used directly for browsing. That produced long mixed department names and an undifferentiated leaf rail. Explore also carried supply filters whose controls were being removed, so merely hiding its selector would have left a hidden Personal/Business filter active.

The shared [browse taxonomy](../../app/packages/contracts/src/categories/navigation.ts) now has 17 departments, 36 useful intermediate groups and all 152 existing publication leaves. Garden contains the four existing garden leaves; Tools and DIY contains the remaining seven renovation/tool leaves. Existing publication IDs, registry version, approval policies and listing references are preserved. Single-group departments skip an unnecessary intermediate step. The [category contract](../categories.md#browse-hierarchy-and-mobile-names--october-7-2026) records the short BG/EN names and future expansion boundaries.

Root Explore has department tiles without a seller selector or empty pill row. Category Explore has one heading and one horizontally scrolling row: All items opens this branch's results, groups drill into Explore and leaves open results. Direct leaf entries show their siblings. Headings, tile titles and pills keep consistent type sizes and use single-line ellipsis. The full label remains in accessible text. Category Back is the existing dock control; no breadcrumb or additional parent row was added.

Home and results retain public supply filtering. Explore's real-data query uses category/language and mixed eligible supply, while its destination links retain the carried result criteria. Those criteria become visible and effective on results. Group queries expand to their actual publication leaf IDs; leaf-specific attributes remain available only for a leaf. Cursor identity includes the browse version. Canonical `nav:` group routes use real adapters and reject unknown groups, including when reference preview is enabled.

## Artwork and editorial content

Seventeen original department illustrations were generated with the explicitly authorized image tool, then extracted and converted to transparent 320×320 WebP assets. Total size is 384,272 bytes; the largest asset is 37,054 bytes. They use the existing tile geometry and colors. [Artwork provenance](../../app/apps/web/public/artwork/categories/README.md) and the local artwork receipt record the generation sources, crops, output sizes and hashes. The initial visible phone mark was removed through the image tool before extraction.

These illustrations represent departments, not available inventory. Shop's top banners are curated editorial entry points; Treido requires an actual collection/product/shop destination and truthful source. They do not automatically establish top-seller rankings or sponsored entitlements. No banner, inventory, rating or ranking was fabricated. The rule is recorded in [BUY-01](../ui-patterns.md#buy-01--discovery-chrome-and-public-seller-scope) and [styling](../../styling.md).

## Database evidence

The additive [0053 migration](../../app/apps/web/migrations/0053_category_navigation.sql) stores the same versioned browse tree in separate tables. It is registered in the migration runner and runtime grants allow reads while denying mutation. It was applied and replayed only against an owned isolated synthetic Postgres cluster. The original category/policy snapshots were hash-identical before and after.

The native check passed:

- 17 roots, 36 groups and 152 unique stable leaves.
- Garden's four exact existing leaf IDs.
- Successful application and idempotent migration-runner replay.
- Runtime reads allowed; INSERT/UPDATE/DELETE denied with `42501`.
- Orphan, cyclic, incomplete parent/leaf, retargeted leaf and duplicate identity rejected by database constraints.

No shared development, Preview or production database migration, policy approval or supply write occurred. Both owned native check clusters were stopped and their state/logs/data were retained. Receipt: `.qa/category-navigation-20261007/native-receipt.json`.

## Source checks

Commands ran from `app/` with pinned Node 24.20.0 and pnpm 12.3.4; web ESLint ran in its package scope so the existing Next rules were loaded.

- Focused unit/route/catalogue run: 111 passed and one existing optional skip across 13 files. After test-only lint cleanup, the two affected files passed all 10 assertions; these overlapping totals are not added together.
- Contracts typecheck and final strict web CI `tsc --noEmit --incremental false -p tsconfig.ci.json`: PASS.
- Scoped web and contracts/test ESLint: PASS; scoped source/CSS/artwork-readme formatting: PASS.
- Product-document contract and its 16 tooling tests: PASS; owned diff/whitespace and audit-relative-link review: PASS.

The initial root-scoped lint invocation did not load Next's plugin and reported a pre-existing input sanitizer rule; the correct web package lint passed. The new unused test import and unnecessary regex escape were removed without changing assertions. Earlier taxonomy assertions were updated to test the new hierarchy. The isolated native harness initially expected the wrong rejection code for retargeting; the actual CHECK rejection was retained and a separate duplicate-ID rejection was verified. Those failed attempts remain in the evidence directory.

## Actual browser evidence

CUA used the existing local 6418 runtime and a temporary background tab. The user tab was preserved, the temporary tab was closed and the viewport override was reset.

| State | Observed result |
| --- | --- |
| Expanded root BG, 393×793 | All 17 illustrations loaded; 17 tile titles at 14px/20px; no seller selector or document overflow. Matched before/after captures saved. |
| Electronics → Computers → Back, BG393 | One category row and one dock Back; returns to Electronics and focuses Computers. The initial new-group 404 was repaired in the canonical route guard and covered by a regression test. |
| Phones → results → nested category filter → group → Personal, BG393 | The sheet drills through department/group/leaves; the applied canonical group URL returns the three actual Personal TEST ONLY items. |
| Results history → originating group | First Back after applying filters returns the previous Search entry; second returns to the Phones/Tablets group and focuses Phones. |
| Root with carried Personal, BG320 | All 17 departments and six mixed eligible preview items remain visible; the preference is retained for destination results. |
| Renovation and long workwear leaf, BG/EN320 | One non-wrapping pill row; long pill and 28px/34px heading visibly ellipsize without font-size reduction or document overflow. |
| Nested Professional equipment sheet, BG320 | The visible heading uses the unchanged 18px/24px style and stays one line; this particular label fits. An earlier hidden seller-dialog selector reading was unqualified and retained. |
| Expanded root EN320 and EN1440 | All 17 departments, 20px tile-title heights and no document overflow. |

Captured application-console errors were empty; the existing Clerk development-key warnings were retained. The early Back measurement ran before focus settled and selected body text; the accepted later measurement identifies the actual Computers link. Raw and qualified observations are both preserved.

Screenshots: `C:/Users/radev/.codex/visualizations/2026/10/06/01a1128e-19f0-7ee0-8bf7-cc128a7f8c13/category-navigation-20261007/`. Local evidence: `.qa/category-navigation-20261007/`, including dirty preimages, artwork/browser/native receipts, scoped diff and final manifest.

## Remaining acceptance

This is a useful first browse hierarchy, not an exhaustive eBay-scale taxonomy. Broad leaves, additional niches and category attributes need versioned expansion and explicit publication-policy review. The existing catalogue is seeded, but its presence does not approve every leaf for publishing or create inventory.

T07a and T23c remain IN_PROGRESS. Source fidelity still lacks qualified editorial/Minis and canonical category-specific presentation. No fresh installed-Shop comparison was available; the assigned emulator was offline during the preceding source audit. No new emulator boot, full production build, authenticated/provider acceptance, hosted verification, commit, push or deployment occurred. Full build was not attempted under the remaining local disk headroom. Next is the source-compared real-data Explore editorial/Minis presentation and reviewed niche expansion, using these same owners and versioned category boundaries.
