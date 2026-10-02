# October 2 — design contracts and AI delivery handoff

## Scope and outcome

T31 updates the actual dirty `main` checkout at `L:/PLATFORMS/treido-eu-global`, not a clone or proposed replacement. The existing preview remains on loopback port 6418. Documentation/agent contracts and small offline documentation tooling are the only implementation scope; application behavior, dependencies, provider bindings, Git publication and deployment are unchanged.

The accepted visual foundation is two related but distinct systems: Shop-derived buyer UI and Shopify-derived Studio. The latter is a merchant interface, not Shopify as Treido's commerce backend. Direct Sell/auth and restricted operations retain their own existing form boundaries. Original Treido artwork, compact phone copy and explicit marketplace adaptations remain approved differences.

## Deliverables

[UI patterns](../ui-patterns.md) specifies actual CSS/component owners, typography, geometry, cards, buyer/seller navigation, sheets, search, Mini, table/editor states, BG/EN and responsive behavior. [UI verification](../ui-verification.md) separates source fidelity, preservation, local product behavior and qualified release acceptance. [Documentation ownership](../documentation.md) maps current contracts and keeps the single [task queue](../../tasks.md) authoritative.

Root and existing workspace/web/native AGENTS are updated; discovery and sellers now have bounded scoped instructions. The four existing repo skills route to the same owning contracts. Product/PRD/features/journeys, architecture, frontend/workflow/testing, README and compatibility entry points are reconciled without replacing feature IDs or historical receipts. A stale architecture assertion that real auth/database/private routes did not exist was corrected; their live qualification remains distinct from local implementation.

The dependency-free `app/scripts/check-product-docs.mjs` and 15 Node tests validate current relative links/anchors, scoped guidance, task structure and recorded manifest/runtime pins. Existing CI now runs these checks and scoped lint/format. It does not automatically validate every screenshot or replace security, database, provider or release gates. The changed workflow is local and has not run on GitHub.

## Fresh verification evidence

The offline document check, all 15 tooling tests, scoped ESLint and scoped Prettier passed. Current results are retained in `L:/Temp/treido-eu-docs-audit-20261002/`; the T31 completion receipt records the final counts. All 706 pre-existing non-Markdown application source/config/test files fingerprinted at the start remained byte-identical at the final comparison, including package manifests and lockfile. The new documentation scripts were not part of that starting set.

Fresh Chrome/Playwright spot checks used an owned clean browser context, not the user's browser profile: Studio EN at 1440×900 and BG at 393×793/320×793; buyer BG at 393×793 and EN at 1440×900. All five loaded states returned HTTP 200 with loaded fonts/visible images, no document overflow and no console/page errors in the corrected capture pass. Actual pixels were inspected on the buyer and Studio phone/desktop captures. These observations do not prove complete route, localization or source parity.

The buyer scope sheet opened with All sellers/Personal/Businesses and dismissed with Escape without changing the URL. Studio Ctrl+K opened a measured 648×480 global-search dialog; a literal query in the fresh empty store showed an honest no-results state, and Escape closed it. Button-trigger focus restoration, store/main-site exits and populated-store flows were not independently rerun by T31; T30g retains its own dated exit/navigation evidence.

Initial screenshots were rejected as baseline evidence because some captured loading states; a mid-hydration caret-style warning also occurred during the initial harness pass. Loaded-content assertions and capture without caret mutation produced the successful final set. Initial observations are retained rather than silently relabelled as passes. Earlier T30g's 703 unit tests/56 files and broader browser sweeps are historical results, not tests rerun by this documentation task.

## Reference and production limits

Existing October 2 source captures from the signed-in Shopify audit were reviewed, including desktop Home and product editor, alongside current local Studio. Their private location remains `C:/Users/radev/Documents/Codex/2026-10-02/treido-shopify-admin/exact-parity/studio-verification/`; no capture or private account data was copied into the repository. The current Codex authenticated browser was not directly controlled by T31. Assigned Shop `emulator-5560` was unavailable; no other emulator or account was used.

T30e still owns unfinished exact-source coverage: editor details, Growth, Markets, remaining Settings and populated reference states. Its local route/layout sweep is not the same as matched source comparisons. Current buyer desktop Home remains a centered narrow feed with substantial card whitespace; this existing layout is preserved, not newly certified as an exact desktop Shop clone. The BG buyer capture still contains inherited English “Shop all” copy. Those observations belong to further targeted desktop/localization acceptance, not a hidden redesign in this documentation pass.

The broad `/admin-preview` uses fictional device-local state and finite Mini tools. Real Clerk/pg/Drizzle private seller/draft/setup adapters exist separately, but intended live bindings and full marketplace journeys remain unqualified. Public catalog/search/detail/store adapters, durable personal/business isolation in the intended environment, real media/payment/job effects and release operations require their existing task evidence. A simulated refund, plan, order or store switch does not establish these capabilities.

## Current stack review and next execution

[The October 2 dependency snapshot](dependencies-2026-10-02.json) records 50 dependency declarations from four manifests and fresh latest/peer metadata for 42 distinct registry packages including pnpm. [Tech stack](../../techstack.md) records the compatible upgrade batches. No packages, lockfile or global toolchain were changed during T31.

Priority remains T02b: qualify the paired Next/eslint-config-next 16.3.4 → 16.3.8 security patch with relevant build, reference-denial, behavior and visual checks. The [official release](https://github.com/vercel/next.js/releases/tag/v16.3.8) lists image-optimization SSRF and other security fixes. The previous failed security gate remains unresolved; this task did not run a fresh vulnerability audit or determine every advisory's exploitability in Treido.

Node 24.20.0 → 24.21.0 is the current LTS patch candidate per [Node's release page](https://nodejs.org/en/about/previous-releases). TypeScript stays at 6.0.3 until the lint/tooling matrix supports a newer major: [typescript-eslint](https://typescript-eslint.io/users/dependency-versions/) currently declares support below 6.1.0. React, native/Expo, ESLint and package-manager updates remain deliberate compatible batches, not a blanket latest-tag installation.

Continue the existing security, parity, real-adapter and launch tasks; do not start another source-selection, design-system rewrite or documentation approval loop. T31 is complete for its documentation/tooling scope only. Full source parity, native inspection, hosted CI, fresh security audit, complete backend qualification and production release are not claimed.
