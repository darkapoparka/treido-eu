# Treido UI pattern library

Owner: this file specifies reusable presentation and interaction patterns; [styling](../styling.md) owns change policy, [verification](ui-verification.md) owns acceptance, and [tasks](../tasks.md) alone owns progress. Read the relevant pattern and its implementation owners, not the whole reference archive. Measurements identify recorded source states; consult their cited audit dates. They are calibration references, not a new universal token package.

## Two visual systems, one marketplace

| Surface | Visual authority | Data and navigation authority |
|---|---|---|
| Public buying: Home, Search, product, seller, cart, account | Existing Shop-derived buyer components and accepted Treido adaptations | Canonical browse URL, eligible public projections and buyer navigation |
| Direct Sell and authentication | Existing selling/account forms and their own typography | Verified continuation and owned draft commands; no mandatory business dashboard |
| Seller Studio: private `/app` and isolated `/admin-preview` | Existing Shopify-measured merchant shell, Inter typography and feature modules | Private: current human/seller/resource authority. Preview: explicitly fictional device state only |
| Platform operations: `/ops` | Existing restricted operator form language; no unrequested restyling | Operation-specific operator grants, never business-owner status |
| Retained native app | Shop composition implemented per platform, with the assigned native reference | Separate native acceptance; responsive web is not a native build |

Shop buyer UI and Shopify admin share design ideas, but they are not the same component library or identical UX. Do not apply Studio's dense table typography to buying, or buyer-sized pills to every admin control. Shopify is a design reference, not Treido's commerce backend. No Shopify account or store is required for a personal seller.

Shopify's current [App Design Guidelines](https://shopify.dev/docs/apps/design) call for merchant workflows that match the host admin and remain adaptable and accessible. Its [App Home reference](https://shopify.dev/docs/api/app-home/latest/web-components) supplies Polaris web components; [Polaris React is archived and deprecated](https://github.com/Shopify/polaris-react-archive). The [migration guide](https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react) applies to iframe-based Shopify apps and their App Bridge integration. Treido Studio implements the selected admin patterns through its existing scoped components/CSS; this guidance does not change the buyer system or install an embedded-app runtime. Public documentation establishes guidance, while actual signed-in admin comparison establishes visual evidence.

## Source and cascade ownership

Buyer foundations live in [globals.css](../app/apps/web/src/app/globals.css), with calibrated feature styles and reference typography. Declared canvas/ink/muted/accent/line colors are `#fdfdfd / #090909 / #767676 / #5433eb / #e7e7e7`; panel/media radii are 28/20px; page gutter 16px, dock offset 32px and control seed 44px. These declarations do not override measured feature values. The system body fallback is not permission to replace a loaded reference font.

Studio owns [admin.module.css](../app/apps/web/src/features/sellers/admin.module.css), [admin-editor.module.css](../app/apps/web/src/features/sellers/admin-editor.module.css), [preview.module.css](../app/apps/web/src/features/sellers/preview/preview.module.css), [search.module.css](../app/apps/web/src/features/sellers/preview/search.module.css) and [studio-mini.module.css](../app/apps/web/src/features/sellers/preview/studio-mini.module.css). `TreidoAdmin` is the local Inter variable face, scoped to merchant containers; fallback is Inter/system sans. Preserve its license/provenance records. Do not distribute font binaries in documentation or promote this font into a buyer-wide reset.

Current Studio shell declarations: ink `#101010`, muted `#707070`, line `#ebebeb`, dark surround `#0a0a0a`; base type 13px/20px, -0.13px tracking, contextual alternates disabled. White canvas radius 16px; desktop inset 4px and sidebar 220px. Home card radius 24px; editor main-panel radius 20px and field radius 12px. These are distinct roles, not inconsistent values to normalize.

Keep Tailwind 4 + CSS + CSS Modules. Preserve source order, selector specificity, inheritance, media queries, scrollbars and DOM wrappers when extracting. Fix an owning selector rather than stacking global overrides or broad substring matches. A numerical match before the cascade resolves is not visual proof.

### Route-to-presenter starting points

| Route family | Reuse these current owners |
|---|---|
| Buyer Home and root Explore | [home.tsx](../app/apps/web/src/features/discovery/home.tsx), [public-home.tsx](../app/apps/web/src/features/discovery/public-home.tsx), [public-explore.tsx](../app/apps/web/src/features/discovery/public-explore.tsx); existing seller containers, rails and dock |
| Search and category results | [search.tsx](../app/apps/web/src/features/discovery/search.tsx), [public-search-results.tsx](../app/apps/web/src/features/discovery/public-search-results.tsx), existing query/filter sheets and return navigation |
| Item and related supply | [published-detail.tsx](../app/apps/web/src/features/discovery/published-detail.tsx), [product-shell.tsx](../app/apps/web/src/features/discovery/product-shell.tsx), [public-listing-grid.tsx](../app/apps/web/src/features/discovery/public-listing-grid.tsx); shared gallery/card owners |
| Public seller | [public-store.tsx](../app/apps/web/src/features/discovery/public-store.tsx), native merchant chrome/CSS from BUY-03 |
| Buyer Minis | [minis-catalog.tsx](../app/apps/web/src/features/discovery/minis-catalog.tsx), [tool-catalogue.tsx](../app/apps/web/src/features/shopping-tools/tool-catalogue.tsx), [mini-frame.tsx](../app/apps/web/src/features/discovery/mini-frame.tsx); BUY-04 below |
| Private seller Studio | [admin-shell.tsx](../app/apps/web/src/features/sellers/admin-shell.tsx), feature modules and scoped admin CSS from STU-01–04 |

Read-only Shop comparison owners are under `L:/inspiration/shop-app/apps/web/src/features/discovery/`: `home.tsx`, `search.tsx`, `product.tsx`, `native-merchant.tsx`, `minis.tsx` and `mini-frame.tsx`, with `src/app/globals.css` and their feature styles. Read the matching branch and imported styles before extracting a presenter. The source Home seller containers, Search composer/results and Minis carousel/inline search identify composition and interaction owners; their reference inventory and assets do not establish Treido eligibility or publication rights.

## BUY-01 — Discovery chrome and public seller scope

Owners: [home.tsx](../app/apps/web/src/features/discovery/home.tsx), [explore.tsx](../app/apps/web/src/features/discovery/explore.tsx), [public-explore.tsx](../app/apps/web/src/features/discovery/public-explore.tsx), [search.tsx](../app/apps/web/src/features/discovery/search.tsx), [browse-scope.tsx](../app/apps/web/src/features/discovery/browse-scope.tsx), [browse-scope.module.css](../app/apps/web/src/features/discovery/browse-scope.module.css), [return-navigation.tsx](../app/apps/web/src/features/discovery/return-navigation.tsx).

The [October 7 source audit](audit/2026-10-07-shop-explore.md) identifies exact retained Explore, category, Minis and Search-filter frames, observed composition and current public-data gaps. Use those source states when accepting genuine browsing; preserved Treido screenshots and passing replay tests alone do not establish source fidelity. Canonical category IDs must select the intended presentation variant explicitly rather than relying on literal captured department names in CSS.

Home keeps the search-led hierarchy, profile/notification controls and single horizontally scrolling Deals / Following / Saved / Minis row. The compact All / Всички pill displays the current supply scope; its existing sheet offers All sellers, Personal and Businesses with a checked selected row. Search keeps this control in its filter strip. Do not reintroduce a second row, underlined reset, desktop-style phone tabs or a larger dock to fit filters.

The selected value comes from the canonical URL. Scope changes preserve search/category/condition/price/location/language/sort and retire pagination. Open/cancel/current-choice/Back preserve agreed focus and scroll behavior; stale responses cannot replace current results. A source fixture without seller-kind facts cannot be relabelled as personal or business inventory. Empty Personal results must not switch the operating business, clear its draft or change its inbox/billing. [Marketplace](marketplace.md) owns these domain rules.

Root Explore uses the [versioned browse hierarchy](categories.md#browse-hierarchy-and-mobile-names--october-7-2026) independently of seller kind, without an empty rail or seller/filter chrome. The owner's October 8 convergence replaces the category-preview-to-Search split: department tiles and See all open the same category results at `/explore/<category>`. Departments, groups and leaves use the original Search presenter and real filtered query adapter. Legacy `/search?category=…` and `/explore?category=…` links redirect with validated criteria and bounded pagination. A category path repairs absent/conflicting query category before reading supply. Category-scoped keywords stay on that route; unscoped queries use `/search`. Keep consistent type and single-line ellipsis; do not add a second heading, breadcrumb, parent row or filter rail.

Category results have one Back control in the dock. It restores the owned source entry with filters/focus/scroll; direct groups/leaves fall back to their recorded parent, and direct departments to clean Explore with seller scope/language. Root Explore's title scrolls with content; retain the fixed dock. Root Home/Explore have no Back. The compact icon in the existing result strip opens the same full-filter sheet on category and global results. Header Close/Back remains local to sheets and staged flows. Opt-in source replay keeps its original routes and presentation.

A directly filtered Home adds an explicit category/filter context and clear action without changing ordinary Home containers, header or dock geometry. Internal category-result aliases resolve before SourceLink or the category-aware dock records its return destination, so filtered Home returns to its actual context action or magnifier with focus/scroll retained. Empty category copy names the category; unavailable reads retain their separate retry state.

Root Explore previews use language and mixed public supply independently of carried seller/price/query criteria. Those criteria apply on category results with visible controls. Root tiles sit 16px below the single title; omit the redundant Browse categories heading. Six departments appear initially, with More/Less revealing the full tree.

Below the root tiles, one original Shop shelf previews each populated department with up to six eligible products. One SQL snapshot applies current publication/media/seller/policy eligibility and independently samples departments. Empty departments have no shelf. Each See all / Виж всички action and department tile share the category-results destination with carried criteria. Organic previews have no invented collection, popularity or sponsorship claims; category results reuse existing qualified Search promotion placement, facets and pagination.

The shared result strip displays the selected category or All categories, including idle entry. Its pill opens the current department/group; a leaf opens its parent with that leaf checked. Unscoped Search starts at all departments. Full filters enter the current draft branch. The sheet has one branch title and a plain Back chevron to its recorded parent, inside a 44px invisible target. Close uses a 24px pale-grey circle inside a 44px target. One All items / Всички обяви selection precedes children; omit the repeated branch name and parent row. Retain 16px text, single-line ellipsis and 56px rows. Short sheets fit content; long lists scroll with header/Done reachable. Done applies a direct draft once; Close cancels the direct flow. Escape/browser Back steps back or cancels without changing results. Full filters retain staged Close/Done. The two history owners remain separate, including Forward. Category changes retain keyword/seller/other criteria, clear category attributes and retire pagination. All categories removes category/attributes while retaining the keyword.

The query field and suggestions heading say Search in {category}. Starting editing opens suggestions/composer immediately, including an empty query; the same input stays mounted above the keyboard. The dock magnifier focuses that editor on the existing result page. Empty submissions clear a committed keyword while retaining category/filters; cancellation restores the committed query. Category and global results share cards, query/filter chrome and sheets.

The top result field displays the query/scope and allows editing; the dock supplies a reachable shortcut to that same editor. Clean Home/Explore to Search is global across categories; within category results the editor retains the category. The category picker's All categories selection removes the category without requiring Home. This scoped dock behavior is a Treido adaptation. The retained Shop results frame confirms a top query field plus dock, but does not establish the dock's complete category-context behavior. Selected-pill rules target direct filter-strip controls so they cannot recolor nested seller-sheet choices; those keep the existing checked-row treatment.

Shop's top Explore banners are editorial entry points into selected collections, products or shops. Treido may use that composition only for an actual curated destination; the banner does not imply a top-seller ranking, promotion entitlement or category count. Generated department artwork illustrates the taxonomy and does not supply inventory or qualify editorial content. Missing curated content stays absent until its real destination and source are available.

Generated department illustrations share an optical height and bottom baseline inside the existing artwork frame. Measure the visible objects and contact shadows rather than their transparent canvas alone; use one common fitting rule and recorded per-asset bounds. Recalibrate those bounds when an illustration changes. This alignment does not change tile geometry, label position, colors or the reference caller's imagery.

Public Explore shelves keep the original 173px card size from 768px upward. The native phone rule sizes cards from the viewport and must not grow them across the full desktop browser inside a bounded page. Phone shelf geometry and the retained reference caller are unchanged by this scoped correction.

## BUY-02 — Listing cards and product detail

Owners: [product-card.tsx](../app/apps/web/src/features/discovery/product-card.tsx), [product.tsx](../app/apps/web/src/features/discovery/product.tsx), [product-gallery-view.tsx](../app/apps/web/src/features/discovery/product-gallery-view.tsx), [product-price-summary.tsx](../app/apps/web/src/features/discovery/product-price-summary.tsx), [product-save-picker.tsx](../app/apps/web/src/features/discovery/product-save-picker.tsx).

Reuse accepted image crop/aspect ratio, corners, price hierarchy, title budget, seller presentation and save affordance. Compare cards within the same family: an editorial rail, product grid and merchant recommendation need not become one oversized universal card. Do not add arbitrary gradients, separators, hover elevation or badges while binding real data.

Marketplace additions use explicit facts: condition, defects, coarse location, seller kind and supported message/offer/buy action. Businesses can sell used goods; personal sellers can sell new goods. Verification, commercial warranty, buyer protection and subscriptions remain separate claims. Missing facts stay unknown; no invented rating, crossed-out price or delivery promise.

Detail retains gallery index, variants, save-sheet stages, price/content/delivery order and seller excursions. Supply bounded detail/recommendation/cart context rather than the entire catalogue. Returning from a seller or image viewer restores item, scroll and selection. Sold, removed, restricted, stale-stock and failed-read states need truthful recovery.

## BUY-03 — Seller presentation

Owners: [native-merchant.tsx](../app/apps/web/src/features/discovery/native-merchant.tsx), [native-merchant-chrome.tsx](../app/apps/web/src/features/discovery/native-merchant-chrome.tsx), [native-merchant.css](../app/apps/web/src/features/discovery/native-merchant.css), [seller-presentation.ts](../app/apps/web/src/features/catalog/seller-presentation.ts), [seller-page.server.ts](../app/apps/web/src/features/catalog/seller-page.server.ts).

One seller presentation supplies cover/avatar/background/foreground/categories/info/reviews/search/follow/share. Use seller-owned public data and neutral fallbacks, not a name allowlist or copied reference identity. Personal listing creation never requires a branded storefront. Preserve seller-scoped search, review filters/media, share/follow feedback and collection returns. Scope a toolbar selector to its owner; the earlier merchant-search styling collision must not recur. Pixel equality with a donor sharing the same defect is not usability acceptance.

## BUY-04 — Sheets, search, cart and account flows

Owners: existing discovery components, [product-information-sheet.tsx](../app/apps/web/src/features/discovery/product-information-sheet.tsx), [cart.tsx](../app/apps/web/src/features/commerce/cart.tsx), [checkout.tsx](../app/apps/web/src/features/commerce/checkout.tsx), account and locale features.

Reuse sheet anchoring, backdrop, dismissal, safe areas and return semantics; do not create a new modal system per feature. Preserve applied versus draft filter state: cancel cannot commit. Errors remain in the current flow with retained input and explicit retry. Screenshots are evidence, never interactive component backgrounds.

The current reference cart/checkout is not stock, quote or payment authority. Real checkout retains its visual family while binding seller/currency orders, authoritative amounts and allocation. Payment redirects, optimistic UI and browser storage never establish a paid order. Preserve buyer account and guest-language flows when adding seller entry links.

### Buyer Profile: real identity and compact account entries

Owners: [public-profile.tsx](../app/apps/web/src/features/account/public-profile.tsx), the existing [ProfilePage](../app/apps/web/src/features/account/pages.tsx) presenter and [public-profile.css](../app/apps/web/src/features/account/public-profile.css). Keep the existing buyer font, rounded panels, two library tiles and dock. Show the real first/last name, or localized Your account when absent; show the email once beneath it with single-line ellipsis inside the available identity width. Preserve its full accessible text. Empty Saved and Following tiles reuse the native heart/storefront geometry in 48px pale circles; eligible library media remains real data, without invented counts or brands.

Order history has one heading and one compact link to the authoritative Orders page, with a 40px icon circle. Profile does not read order history and must not assert No orders yet. The public presenter omits the unconnected passkey promotion, Connections and Development mode controls. Pending Clerk hydration shows localized account loading and conceals private contact/preferences until server and current client identity agree; a confirmed failure retains the existing unavailable/retry state. Reference-only account compositions remain separate.

### Buyer Minis: catalogue and readable tool canvas

The catalogue reuses `MiniCatalogSurface`, the existing featured carousel and row presentation, original Treido artwork and four-destination dock. Keep 72px recent thumbnails and 44px row icons. Inline `native-mini-searchbar` / `native-mini-search-results` preserves the catalogue query through a tool excursion; Cancel/Escape returns focus to Search. Mini-only `miniSearch` / `miniQuery` presentation state stays separate from public `q` and filters. Show actual visits and the seven real tools; Voice is an input mode within Find.

`MiniShell` already supplies the main landmark and black 44px host header. Its direct screen child is a `<section className={s.content}>`, activating the existing `.mini-shell > section` rule: 28px top corners and `min-height: calc(100dvh - 44px)`. Genuine tool modules explicitly give `.content` the existing white `var(--surface, #fff)` background and `var(--text-primary, #171717)` text. Reuse [tool-ui.tsx](../app/apps/web/src/features/shopping-tools/tool-ui.tsx) and the owning shopping-tools, gift-finder, photo-match or assistant-tools CSS module. Keep native reference skins in their own owners.

Loading, guest, denied, empty and unavailable tools use this same readable canvas and reachable actions. Inspect computed colors, one main landmark, keyboard focus, long translated copy and mobile overflow in those states as well as results. Keep the accepted header, font, form spacing and artwork frame while repairing a surface defect.

For task screens, read the Shop comparison's `discovery/sol.tsx` and `sol.module.css` for the conversation/composer hierarchy. Place the actual task input before optional advanced criteria. Reuse [IntentControls](../app/apps/web/src/features/shopping-tools/intent-controls.tsx) and its existing details/form for those criteria, and [AssistantInterpretInput](../app/apps/web/src/features/assistant-runs/interpreted-intent.tsx) for genuine text, voice or photo actions with consent and canonical review. Preserve input, criteria and return state. Feedback cards need an actual status, pending operation or message; keep idle Reload in a compact action row. Source fixture responses and staged microphone behavior do not establish a connected assistant.

## STU-01 — Shell, page hierarchy and exits

Owners: [admin-shell.tsx](../app/apps/web/src/features/sellers/admin-shell.tsx), [merchant-preview.tsx](../app/apps/web/src/features/sellers/preview/merchant-preview.tsx), [workspace-links.tsx](../app/apps/web/src/features/sellers/preview/workspace-links.tsx), [settings.tsx](../app/apps/web/src/features/sellers/preview/settings.tsx).

Desktop uses the 220px dark fixed sidebar and inset rounded white scrollable canvas, compact icon/label rows, selected-row treatment, collapsible navigation, seller identity and Settings. Keep the stable scrollbar gutter. Do not reinterpret it as a generic grey dashboard with an unrelated top bar.

At the existing 767/768px shell boundary use the phone drawer and floating controls, not a squeezed sidebar. Drawer content is the active accessible surface; translated inert background content is not an interactive overflow escape. Restore focus/scroll; close through destination, backdrop or Escape. Check collapsed desktop navigation as well as expanded states.

Go to Treido returns to buyer Home in the current language. View store currently opens the selected fictional store at `/admin-preview/store/preview` outside the shell, with admin/main-site return links. Preserve store/language and Back to the original Products query or Settings screen. A local preview cannot masquerade as a published seller URL; real public linking follows the qualified adapter.

## STU-02 — Home, plan pill and setup cards

Owners: [admin-home.tsx](../app/apps/web/src/features/sellers/admin-home.tsx), [admin-home.module.css](../app/apps/web/src/features/sellers/admin-home.module.css), preview Home composition and [admin-art.tsx](../app/apps/web/src/features/sellers/admin-art.tsx).

Desktop Home has a bounded central region: declared maximum 936px, three cards with 16px gaps, two at the existing 1000px boundary and one on phones. Do not widen its content indiscriminately with the outer canvas. At the recorded 1440×900 state, cards measured 300×344px at x357/673/989 and y407.1875; at 393×793, 350×304px with the first at x16/y324. These identify a source state, not absolute-positioning instructions for every viewport.

Card titles use 15px/18.75px, medium weight; body uses 13px/20px. Keep artwork placement, padding and bottom-aligned actions. Use original Treido illustrations, not Shopify promotional imagery. Load visible art before comparison. The preview Home composer measured 622×106px on desktop and 350×106px at 393px. It opens Sell Helper, not global search. The black plan pill has a green indicator and local Plan destination, but no invented live promotion.

T30f deliberately adapts phone copy: Welcome! / Добре дошъл! and Set up / Настрой plus the linked store name. Preserve two 32px rows at normal phone text, the 26px heading and normal single-line 36px plan pill at 320px. Truncate only an overlong store-name link, retaining its full accessible name/title. Doubled text can reflow; never scale the interface. Desktop retains longer copy. Dismissed setup cards can be restored; real readiness derives from authoritative facts, not dismissed cards or a percentage.

The real Home presenter uses the same compact phone copy and a bounded seller-name span with full text/title; it retains its existing server-derived name presentation and authorized destinations. Its own module hides the phone composition on desktop and leaves shared shell, font, search, artwork and card styles intact. A missing selected seller uses Your workspace / Твоите продажби. Use the actual presenter for comparisons; the device-local preview context is not an adapter for private Home.

## STU-03 — Global search and seller Mini are different tools

Owners: [search.tsx](../app/apps/web/src/features/sellers/preview/search.tsx), [search-model.ts](../app/apps/web/src/features/sellers/preview/search-model.ts), [studio-mini.tsx](../app/apps/web/src/features/sellers/preview/studio-mini.tsx), [studio-mini-composer.tsx](../app/apps/web/src/features/sellers/preview/studio-mini-composer.tsx), [studio-mini-model.ts](../app/apps/web/src/features/sellers/preview/studio-mini-model.ts).

Global Search opens from sidebar, phone menu, Settings or Ctrl/Command+K. The measured desktop surface is 648×480px; phones span the viewport below y64 with top-rounded corners. Preserve chips, literal product/SKU queries, idle/results/empty states, arrows, Enter and one-Escape dismissal with focus return. Preview search uses the selected fictional store; private search remains an authorized query. No fixture fallback may bridge them.

Sell Helper opens a full canvas on Home/phones and a 356px side panel from other desktop pages, with Expand/Collapse. Preserve prompt/recents/composer hierarchy and overlay layering. Recents stay seller-scoped. Finite local tools search products, check missing facts and prepare reviewable drafts; they are not connected generative AI. Voice explains unavailability without activating a microphone. Draft preparation invents no price, condition, quantity, photos or publication permission. Buyer Minis retain their own presentation; [assistants](assistants.md) owns connected tools and evaluation.

## STU-04 — Product tables, forms and feedback

Owners: [admin-products.tsx](../app/apps/web/src/features/sellers/admin-products.tsx), [admin-products.server.ts](../app/apps/web/src/features/sellers/admin-products.server.ts), [admin-draft-form.tsx](../app/apps/web/src/features/sellers/admin-draft-form.tsx), preview [products.tsx](../app/apps/web/src/features/sellers/preview/products.tsx) and [ui.tsx](../app/apps/web/src/features/sellers/preview/ui.tsx).

Preserve compact table/toolbar hierarchy, thumbnails, statuses, selection, row actions and query state. Row navigation cannot compete ambiguously with checkboxes/menus. Real queries are seller-authorized, bounded to 30 rows with stable keyset pagination; a preview array is not that query. Bulk actions need explicit IDs/revisions and per-item results, not unbounded implicit select-all.

The private editor declares a flexible main column, 282px side column and 47px gap; 1050/900px intermediate rules and phone stacking belong to its CSS. Main panels use 16px padding/gaps, 20px radius and subtle shadow. Labels are 13px; input/select minimum height is 30px and description minimum height 187px. Sidebar sections keep their own separators rather than duplicating main cards.

Studio primary/secondary controls have a 28px visual minimum and compact 12px type; buyer control seeds are 44px. Do not normalize both to an arbitrary height. Verify actual reachable targets/spacing, touch use, focus and 200% text. Fix demonstrated accessibility defects through bounded exceptions, not by shrinking text or enlarging every control globally.

Forms keep labels, units and gentle validation; associate errors with fields. Failed saves retain input; revision conflicts offer explicit comparison/recovery. Unconfirmed condition is not New; zero draft price/quantity is not sale-ready. Preview Save is browser-local; private Save acknowledges a durable authorized revision.

Loading, true empty, unavailable, denied, validation error, conflict, pending, success and restricted states are distinct. Never report no orders when their service failed, or confirm refund/payment/verification/publication from a browser toggle. Use status text as well as color.

## SHARED-01 — Copy, responsiveness, motion and assets

Touched copy needs BG/EN ownership, interpolation and long-name tests; avoid concatenating translated fragments. Preserve locale URL/cookie/server precedence. Extended inherited Studio forms still need translation work; a Bulgarian shell is not full localization.

Check 320/393px phones, 390px continuity, 767/768px shell transition, affected 900/1000/1050px content boundaries and 1024/1440/1920px desktop. Test immediately either side of a changed breakpoint. Use realistic content, doubled text, focus-visible, reduced motion, Back/Forward, scroll and open overlays. A phone screenshot stretched to desktop is not responsive acceptance.

Preserve reduced-motion behavior; animation cannot hide missing state transitions. Asset replacement keeps crops, dimensions, loading priority, semantics and rights provenance. Original Treido branding/art and compact phone copy are approved differences, not evidence of pixel identity with Shopify.

## Integration without visual regression

Bind real adapters behind accepted view contracts, removing preview assumptions one route at a time. Never import preview context into private queries or fabricate empty data after a service failure. Characterize current surfaces before extracting shared presentation; do not fork a second merchant application. A matching screen, working local interaction, authorized resource and real provider transaction are four separate claims. Record each separately under the owning task and [UI verification](ui-verification.md).


## BUY-11 — Language suggestion and picker

`features/locale/language-prompt.tsx` owns the first-visit buyer suggestion; its CSS module uses a black rounded surface no wider than 360px, 16px minimum phone gutters, and a measured 12px gap above `.floating-dock`. It does not move the dock or alter catalogue cards. Hide it for other open dialogs and private/purchase flows. `language-picker.tsx` reuses the existing Sheet, focus/history behavior, radio controls and primary button. The permanent Profile footer button reopens the picker after a choice or dismissal. Locale selection is independent of country, listing currency and operating seller. Use stable semantic selectors rather than translated accessibility labels. This is a Treido implementation of the requested pattern, not a newly measured Shopify pixel comparison.
