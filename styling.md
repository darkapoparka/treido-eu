# Styling — preserve buyer and Studio systems

The [UI pattern library](docs/ui-patterns.md) records actual component/CSS owners, typography, geometry and flows for the Shop-derived buyer and Shopify-derived Studio surfaces. [UI verification](docs/ui-verification.md) defines matched-state acceptance and distinguishes source fidelity, preservation, product behavior and release readiness. This file remains the sole change-policy authority; those documents specialize it, not replace it. Studio fonts, compact controls and sidebar/canvas must not leak into buyer/direct Sell/auth screens.

## Final pattern policy and named adaptations

The October 1 source decision keeps Shop as the visual foundation. The 1:1 contract below applies to refactors and unchanged regions. It does not require copying every Shop behavior or waiting for full native parity before building Global. This documentation pass changes no rendered screen.

Future product tasks may implement these specific adaptations in existing component/CSS owners:

- Home: keep business vitrini and add useful individual-listing discovery. Show readable product names and prices; do not require each personal seller to configure a branded shop before listing an item.
- Cards/detail: condition, material defects, location, personal/business disclosure, applicable shipping/pickup and the correct message/offer/buy action. Seller type, verification and warranty remain independent facts.
- Search: a useful idle browse state, visible keyword search and taxonomy/facets; preserve canonical query/filter/Back/scroll state. An assistant is optional. Remove captured country/postcode, stale titles and delivery-date assumptions from real-data presentation.
- Selling: make listing creation easy to find and keep drafts recoverable; retain existing control, sheet and form vocabulary.
- Seller workspace: the owner's October 2 request (D30/T30) adopts the actual signed-in Shopify admin geometry, typography, surfaces, controls and responsive navigation inside private `/app` merchant screens. Use Treido branding and real marketplace capabilities. Scope admin tokens and any licensed font to this area; preserve all buyer regions and direct selling/authentication flows. Compare actual desktop/mobile Home, Products and editor states. Unsupported provider features must remain honestly unavailable.
- Desktop: use available width for effective result comparison and filters while retaining type/image/control roles and phone behavior. A fixed narrow mobile column is not automatically good desktop UX.
- Tools: expose task-specific catalog assistance with editable results and clear unavailable/error states, using existing Mini patterns.

These are bounded product changes, not a new theme or blanket spacing rewrite. Record the affected route/state, data contract, intended geometry/content difference and before/after action/return evidence. The final selection supplies direction; passing relevant checks and visual review supplies implementation evidence. Do not seek a new source-selection approval for each ordinary fix.


**Contract:** a refactor changes implementation, not appearance. Existing typography, spacing, geometry, color, imagery placement, motion and interaction behavior remain 1:1 at matched states. This is not a redesign request and not a claim that every current screen already matches the native Shop app.

## Source of truth

The copied application at `app/apps/web` is the current visual baseline. The native Shop app on the specifically assigned `emulator-5560` and retained source captures are comparison references. That emulator was offline on September 28 and unavailable in the October 2 T31 probe; no new native comparison was performed by T31. Do not substitute another emulator or invent unseen screens.

T01 records a baseline commit/file state, browser, operating system, viewport, device pixel ratio, font availability, fixture, route, scroll position and overlay state. A screenshot without those conditions is not a reproducible baseline. Once accepted, do not regenerate it simply to make a diff pass.

## Actual styling system

The web uses Tailwind CSS 4, ordinary CSS and CSS Modules. The audit found **no StyleX dependency/import**. Keep this system. Do not introduce StyleX, a component-library theme, a new utility framework or a default font as a refactoring step.

Existing seed tokens in `src/app/globals.css` include:

| Token | Current declaration |
|---|---|
| `--color-canvas` / `--color-ink` | `#fdfdfd` / `#090909` |
| `--color-muted` / `--color-accent` | `#767676` / `#5433eb` |
| `--color-line` | `#e7e7e7` |
| `--radius-panel` / `--radius-media` | `28px` / `20px` |
| `--page-gutter` / `--dock-bottom` | `16px` / `32px` |
| `--control-size` | `44px` |

These are **source declarations, not universal computed values**. Later selectors, feature CSS and calibrated typography can override them. Inspect the affected DOM and computed styles before extracting a token. The body begins with system fonts at 14px / 1.3; do not replace calibrated feature font families or metrics with that fallback.

## CSS ownership

Global CSS owns resets, shared tokens, basic typography and genuinely shared structural primitives. Feature-owned CSS or CSS Modules own their local components. Existing root CSS imports include several large feature stylesheets; moving them is a migration, not harmless cleanup.

When extracting: preserve selector specificity, source order, cascade layers, inherited values, media queries and DOM structure. Move one visual owner at a time and compare related routes. Converting a selector into a Tailwind class or CSS Module may change precedence even if the numeric value looks identical.

Fix a defect at its owning component/selector. Do not append global overrides, broad substring selectors or new `!important` patches to conceal an ownership problem. Do not remove old overrides until their affected states are tested. A one-off exact measurement can remain local; do not build a giant token package from every pixel.

## Component and interaction lock

Keep card/image aspect ratios, crops, icon silhouettes, stroke/size, text wrapping, truncation, header/dock positioning, safe-area handling, scroll containers, sheet anchoring, z-order and hit targets. Do not scale the whole interface to force screenshot similarity. Do not duplicate the page tree for each viewport as an extraction shortcut.

Preserve Back/Forward, return scroll, gallery index, saved-state behavior, overlay dismissal, focus return, keyboard opening and reduced-motion handling. Components remain real text, controls and images—not screenshots of screens. Loading, empty, error, disabled and pending states are part of the design contract.

Semantic improvements with unchanged appearance can proceed in a focused task. Visible accessibility defects must be fixed through a recorded, narrowly scoped exception; “1:1” is not permission to retain an unusable control indefinitely. Never silently alter typography or layout while describing a change as accessibility-only.

## Approved product evolution, not blanket redesign

The owner-approved seller selector reuses the existing pill and sheet geometry. One current-scope pill beside profile/notifications opens All sellers, Personal and Businesses; the selected sheet row has a checkmark. Keep Deals/Following/Saved/Minis in the same horizontally scrolling header, with no separate row of scope pills or underlined reset. Search places the selector in its existing filter strip; the dock remains destination navigation. It filters results; it is not the operating-account switcher. [Marketplace](docs/marketplace.md#browse-scope) defines behavior.

Condition, defects, seller disclosures and necessary sale/message controls can be added in dedicated product tasks using the same hierarchy. Treido branding, original media and copy changes have intentional visual differences; record them separately from logic-only extraction. Do not smuggle in a new home layout, accent palette, navigation system or SaaS dashboard.

The full target in [journeys](docs/journeys.md) adds category fields, business variants/imports, grouped checkout, plans/boosts and useful [Minis](docs/assistants.md). Reuse existing form/card/gallery/sheet/control owners. Each task records its specific allowed content/control difference and compares the unchanged surroundings. Full feature scope does not unlock global restyling; a documentation change itself changes no rendered screen.

A visual exception records: task ID, reason, route/state, precise allowed difference, before/after evidence and its authorizing product requirement or owner decision. The named adaptations above are recorded direction; additional unrelated changes need their own scope. Approval of one changed region does not update unrelated baselines.

The October 2 language refinement uses “Всички” / “All” on the default seller trigger and keeps the full label in its sheet/accessibility name. BG/EN Home shortcuts, Search composer/chips and dock accessibility copy use the same existing controls and CSS. Profile's Language & location row and settings screen reuse the account forms; they do not authorize changing adjacent account content or the merchant theme.

## Verification matrix

Start with the existing reference viewport **393 × 793**, then check affected layouts at widths **390, 1024, 1440 and 1920**, and a narrow 320px/long-copy case. Use known fixture and font loading completion; inspect mobile keyboard, safe areas and scroll behavior. Desktop uses the existing responsive presentation, not a new interpretation.

For a pure refactor: compare before/after images on the same platform with zero intentional layout/color/type differences; inspect any pixel noise instead of raising a blanket tolerance. Pixel equality across different operating systems is not assumed. Mask only genuinely nondeterministic content with documented scope, never the component under test.

Run the affected journey tests as well. Passing screenshots do not prove interactions; passing interactions do not prove visual parity. Keep meaningful evidence in local artifacts with a compact receipt in `tasks.md`.

## Assets and production

Retain source references and licenses; never delete unique evidence in cleanup. Reference font/media routes are not automatically licensed production assets. Verify rights, remove captured personal details from production fixtures, and replace branding/assets through approved tasks before publication. Font substitutions require typography comparison and approval, not an unnoticed fallback. No font files belong in shared documentation bundles.
