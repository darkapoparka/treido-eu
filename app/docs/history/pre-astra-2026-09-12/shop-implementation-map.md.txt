# Shop implementation map

Execution and evidence map for the frozen Shop corpus. `shop-frame-ledger.md` remains the frame record; `shop-parity-checklist.md` remains the acceptance ledger. Current owner mode is **GitHub tools + GitHub Actions, main only**; see `single-session-execution.md`. Do not return to a Windows checkout or another local source checkout.

## Fixed source and comparison

- Frozen corpus: 97 flows, 424 ordered flow frames, 323 standalone media entries. These are different inventory counts, not interchangeable completed-screen counts.
- Primary browser viewport: **393×793**.
- For the documented 1179/1180×2676 flow rasters, normalize the source to 393×892, then crop `(0, 59, 393, 793)`.
- Do not resize the live screenshot. Do not apply this normalization blindly to standalone media.
- The fixed crop excludes native status chrome and the Mobbin footer. Additional keyboard/provider boundaries require frame-specific evidence. Never mask app-owned controls, incorrect imagery, typography, layout or missing content.
- Videos and standalone entries not reconciled with a flow remain explicit obligations; still screenshots do not establish transition parity.

## Mapping and canonical owners

`node scripts/shop-parity/run.mjs enumerate` produces `.qa/shop-parity/frame-map.json` from the frozen manifest and committed recipes:

`source frame → family → route/query → scenario → setup/actions → scroll/focus/overlay → comparison/evidence`.

A route hint is not executable coverage. A reproducible definition is not visual completion. Retain every source frame even when several frames share a route or pixels.

| Flows | Family / canonical owner |
| --- | --- |
| 1, 94 | onboarding/login: `/onboarding`, `/login` |
| 2–6, 42 | Home/notifications/deals/following |
| 7–13 | Saved/collections: `saved.tsx`, `saved-card.tsx`, `saved.css` |
| 14–16, 40–41, 96–97 | storefront/collections/search/filter/info/video |
| 17–20, 32, 37–38 | product/gallery/save/cart/contact/report |
| 21–31 | cart/checkout/review/pay/receipt |
| 33–39 | product/store reviews and reports |
| 43–49 | Search/assistant/result filters |
| 50–59 | Explore/Minis |
| 60–68, 79 | Orders/history/tracking/manual order/review |
| 69–78 | Profile/account/people/preferences |
| 80–82 | payment methods/card add/detail/delete |
| 83–84 | addresses/detail/delete |
| 85–93 | security/notifications/connections/privacy/support/logout |
| 95 | widgets web adaptation |

All families remain in scope. Preserve working canonical components and state rather than making disconnected screenshot pages. Captured history jumps belong in explicit named entries with source notes; do not invent a causal UI transition that the source does not show.

## Current checkpoint: 2026-09-12

### Source changes actually committed

The implementation through **`77efe3e2730c0cd65349eb4f0c6b529b1b8cb8e4`** includes:

- A canonical Saved card rendering the captured multi-brand library, size variant, price, offer chip and photograph layouts. A genuinely obscured pink listing retains an honest details boundary and no invented purchase price.
- Six real, selectable More ideas products, including Jojoba at the visible captured $14 price, with real product navigation and collection/Saved membership transitions.
- Persistent collaboration-suggestion dismissal, captured public/private confirmation states, and explicit disconnected sharing/invitation boundaries.
- Separate Saved-library, two-item, expanded, renamed and deletion scenarios where the frozen sequence switches histories.
- `recipes-saved.mjs` replaying all **27 frames in flows 7–13**, including focused editors and explicitly excluded native-keyboard regions.
- Ten focused Saved journey tests covering creation, all recommendations, partial-listing boundaries, membership, navigation, visibility, edit/cancel and deletion invariants.

**`b12796d8a7fad047b306ed4a60e4c359317d31b4`** additionally applies the measured brightness treatment to acquired Rice/Argan originals in the Saved card. It has lint/typecheck evidence but no rendered evidence yet: its subsequent run failed product acquisition.

No proposed shared-dialog history fix was committed. The `GitHub.update_file` attempt for `components.tsx` was blocked before writing. Do not treat the proposal or a conversation description as code on main. An unrelated later Saved-card write succeeded; do not describe all GitHub writes as unavailable.

### Coverage and actual Actions results

The `frame-map.json` from run **34677545900** records **148 reproducible definitions / 424 frames**, with **276 still route hints**. It does not mean 148 screens are visually complete. The checked-in frame ledger still needs regeneration from this newer Actions evidence rather than its older PC-only baseline.

Run **34677545900** evaluated `77efe3e2730c0cd65349eb4f0c6b529b1b8cb8e4`:

- Installation, frozen-reference verification, product preparation, web lint and typecheck passed.
- **52/52 selected frames captured and scored**, across flows 2–13, 42 and 84. This includes all 27 Saved frames.
- **46 interaction tests passed; 4 failed**. Saved-specific tests: 8 passed, 2 failed.
- Only **`f005-004` and `f006-002`** cleared both numerical diagnostic thresholds in this run. Neither receives automatic visual/owner acceptance.
- Artifact **10292614218** contains the exact-commit reports, interaction results and reference/live/overlay/heatmap images.

Run **34678202940** evaluated `b12796d8a7fad047b306ed4a60e4c359317d31b4`:

- Frozen source hashes, web lint/typecheck and browser install passed.
- Product preparation failed checksums for `rice-bundle`, `shower-caddy`, `home-air-dry-cream`, and `rice-shampoo`.
- Captures/interactions were skipped. Artifact **10292814536** retains the rejected candidates and log for inspection, not as verified served assets.

The earlier acquisition repair at `19ed8235a9ba1a95a090fc76518fabe39400f43f` enabled actual browser evidence in run **34676399228**. Later changing downloads show that acquisition is still unstable. Do not repeatedly replace hashes without justified inspection or weaken the gate.

Foundation run **34677545892** failed the formatting stage of `pnpm check`; build/smoke steps were not executed. The passing web lint/typecheck is separate from a passing foundation/build workflow. Older local reports and the historical 94/94 test claim do not establish current-main results.

### Exact unresolved frames and behavior

All Saved frames **`f007-001`–`f007-004`, `f008-001`–`f008-007`, `f009-001`–`f009-003`, `f010-001`–`f010-002`, `f011-001`–`f011-005`, `f012-001`–`f012-003`, `f013-001`–`f013-003`** remain visually unresolved. Actual pairs expose typography, compact collection spacing, featured-brand size, photo treatment, translucent dock/scroll fade and rich-library residuals. The obscured lower pink photograph is not reconstructed or masked away.

Open interaction failures, with the original assertions retained:

1. Nested Billing Back closes the Payment methods editor as well as the child sheet.
2. A filter-history test navigates to `about:blank` after an overlay Back.
3. The compact Invite collaborators action's fallback avatar initial participates in its accessible name; correct that name rather than dropping the exact assertion.
4. The More ideas scroll test measures before the click is repositioned clear of the dock. Establish a scrolled, unobscured starting click and retain exact return-scroll/focus and Back/Forward assertions.

Other selected frames also remain open except for the two numerical candidates named above. Some Home scores changed sharply between runs even though the latest changes were Saved-scoped. Inspect the actual artifacts, image availability, stylesheet loading and replay entry state before attributing that change to a CSS improvement or regression.

### Exact next execution point

First restore stable, provenance-verified acquisition of the four rejected product photographs, without silently accepting candidates or serving mismatches. Correct the unblocked Saved accessibility and test-setup issues. Keep the blocked shared-dialog write explicit and do not bypass it through a different interface or the owner's computer.

Next complete coverage family: **14–16, 40–41, 96–97**, using existing storefront owners. Flow 14's ordered montage was inspected; no new storefront code or replay was committed in this batch. Inspect the remaining source sequences before editing. Continue through the other product/review, search/Minis, checkout/orders, onboarding and widget families; do not stop at this next family or polish one card indefinitely while most of the corpus remains unmapped.

Regenerate `shop-frame-ledger.md` with the existing generator in Actions when recording the next measured batch. Keep implemented, interaction-tested, compared, numerically passing, visually unresolved and owner-accepted distinct. **No new owner acceptance has been recorded.**

## Measurement and regression guard

`MAE% = 100 × sum(abs(referenceRGB − liveRGB)) / (255 × 3 × unmaskedPixels)`.

Secondary diagnostics are normalized RMSE, the percentage of pixels whose mean channel error exceeds 12/255, 50:50 overlays and difference heatmaps. Default diagnostic gates remain **MAE ≤ 1.5% and bad-pixel-12 ≤ 8%**; inspect meaningful visual and behavioral mismatches even below those gates.

Keep a shared change only when affected states improve without an important sibling regression. An unexplained increase over **0.15 MAE points** requires investigation, not a lowered threshold or silent baseline approval. Thresholds may be tightened, never loosened merely to increase completion counts.

## Existing execution loop

Run `.github/workflows/shop-parity.yml` on an exact main commit. The ephemeral Actions preview may use `127.0.0.1:6412`; this is not permission to use the owner's computer or a local development checkout.

```sh
node scripts/shop-parity/run.mjs enumerate
node scripts/shop-parity/run.mjs baseline --all --flows 2-13,42,84 --run ci-COMMIT_SHA
node scripts/shop-parity/run.mjs compare-runs --before BEFORE_RUN --after AFTER_RUN
```

Use the declared Node/package-manager versions and lockfile. Wait for target UI state, `data-shop-interactive=true`, fonts, image decoding and stable frames. Capture each independent checkpoint in a fresh browser context; drive actual buttons/navigation inside each replay. Inspect reference/live pairs, check relevant 320/430 containment, run focused family tests, commit coherent source batches directly to main and retain exact-commit evidence.

Do not count routes, test passes, screenshot files, numerical candidates or owner acceptance as the same thing. Do not restart the implementation, invent missing facts, use screenshot-painted controls, hide failures or create another scoring framework.
