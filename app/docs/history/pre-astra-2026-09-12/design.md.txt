# Frontend design specification

Build the buyer frontend from the selected Shop reference, not from an earlier Treido frontend. Match styling AND interactions: typography, geometry, colors, cards, navigation, sheets, transitions and flows. [product.md](product.md) defines features; [tasks.md](tasks.md) defines numbered implementation packages; [verification.md](verification.md) defines batch review. No generic ecommerce substitute.

## 1. Exact source

[Owner-selected Shop iOS capture on Mobbin](https://mobbin.com/apps/shop-ios-1f1a3d5b-cb65-4c7e-af4b-e4cdf1c03e4d/7b6adbde-de48-47c5-979b-f629f1eb87a9/screens)

Collection: `shop-ios-1f1a3d5b-cb65-4c7e-af4b-e4cdf1c03e4d`. Capture: `7b6adbde-de48-47c5-979b-f629f1eb87a9`.

Inspected on 2026-09-08: the selected capture lists **323 screens**. Eleven highlighted stills were inspected individually in the browser; their detail pages label them **iOS (393x852)**. The home screen's More info panel reports upload date **September 7, 2026**. This is an upload date, not proof of the app release date. Device model, OS/app version, pixel density, content-only viewport, font identities and motion remain unverified. A private local source archive now contains one exact page-assets download per ordered source screen, but acquisition is not visual review or implementation approval. Do not silently substitute another capture even when Mobbin labels this one Latest.

Browser access correction (2026-09-08): the connector reports that a paid plan is required, but that does **not** establish a browser blocker. Direct browser navigation successfully rendered ordinary screen-detail pages, the UI Elements catalogue and the Flows catalogue, including source media. The capture's Flows tab lists **97 flows**. Continue inspecting the browser content; do not ask for an upgrade/login based only on the banner or connector response. No purchase, paywall bypass or restricted download-all action was attempted.

## 2. Implementation sequence

**Task 2:** Inspect and map screens/flows, measure shared patterns and record explicit web/Android/desktop differences. Approve the discovery slice before Task 3; extend to complete declared coverage before Task 6. Merchant/admin and product-specific screens need their own reviewed design, not fake Shop provenance.

**Task 3:** Build buyer discovery on web/native: measured shell, navigation, cards/shelves, home/search/store/product, overlays and working local state. Use isolated deterministic fixtures when the backend is absent. This is the start of reproducing Shop; it does not wait for payment integration.

**Tasks 4-5:** Connect those components to real catalog/auth; build the matching cart, checkout and order flows with real isolated commerce. Do not create new components just to replace the fixtures. Keep the underlying food model from day one; reference content does not require a fashion schema.

**Task 6:** Complete the remaining mapped buyer/account/support/communication states and review the full declared source scope. Actual account/purchase behavior is connected; unfinished communication delivery may be labeled fixture-only until Task 9. The owner/design reviewer explicitly approves source fidelity before branding.

**Task 7:** Apply Treido identity and food content through that same implementation, then review the adapted batch. No permanent reference/Treido skins, alternate homes or throwaway clone.

Use the source typography/palette/content during comparison, with named approved asset/platform substitutions. Do not introduce Treido green/yellow/red, extra badges, larger cards or invented navigation before source approval. Scope fidelity to exact screens/states/platforms/commit, not an unbounded claim of literal native parity everywhere.

## 3. Reference coverage registry

The labels below are reference families, not execution tasks or verified Mobbin screen IDs. Task 2 expands each into actual screens/states/actions and records source evidence in this section. There is no separate task queue here.

| Family | Required source coverage | Initial evidence |
| --- | --- | --- |
| Home | Launch, source tab model, shelves/cards and scroll | Launch/home stills inspected; transitions and scroll unverified |
| Discovery | Categories, facets, filter/sort sheets, result states | Chips visible in results; category/sheet states missing |
| Search | Entry/suggestions/results/clear/back/empty/recovery | One populated results still; remaining states missing |
| Store | Seller storefront, product entry and follow/save if present | One populated storefront still; actions unverified |
| Product | Images/options/quantity/add/save/unavailable states | One product and one reviews still; remaining states missing |
| Cart | Items, quantity/removal, empty, grouping and recovery | One seller cart overlay with discount error; remaining states missing |
| Checkout | Sign-in return, address/fulfillment, review/payment and return | Not captured |
| Account | Profile, saved items, addresses/settings and selling entry | One saved/collections still; identity/settings missing |
| Purchases | History/detail/tracking and issue entry | One tracking/detail still; history/recovery missing |
| Communication | Inbox/notification/support entry or explicit Treido-specific alternatives | Buyer assistant/voice stills only; merchant messaging/support missing |
| Desktop/tablet | Reviewed adaptation of the source buyer patterns | Separate composition required |
| Merchant/admin | Operational navigation, editors, queues, finance/team and privileged states | Task 2 defines from product.md, not Shop buyer parity |

Each entry records: requirement IDs, source/capture/screen IDs, logical viewport and density, fixture/state, entry/action/outcome, back/dismiss/keyboard/scroll, component owner, destination, named exceptions and review evidence. Classify as source-match, approved-platform-adaptation or Treido-specific. Required product functionality absent from Shop is not silently omitted.

Do not paint a fake iOS status bar into a website. Record system chrome/content viewport separately. Android/browser differences need specific decisions, not a blanket exemption from fidelity. Fonts/assets must be lawfully available; record permitted substitutions before claiming a match.

### Inspected source stills (partial, 2026-09-08)

All links below were opened from the selected capture's highlights and visually inspected. Descriptions identify visible structure; they are not pixel measurements or proof that a control was exercised. No restricted screenshot collection, personal order identifiers or reference assets were committed.

| Source screen | Visible state and structure | Treido mapping / missing evidence |
| --- | --- | --- |
| [Launch](https://mobbin.com/screens/3207d87f-9782-4798-b37b-d49812265939) | Purple surface, centered Shop wordmark, system status chrome | BUY-001; onboarding progression missing |
| [Home](https://mobbin.com/screens/eb9349cf-319e-4694-8a5b-5dc7bf1e25c9) | Avatar, Deals/Following/Saved shortcuts; tracking and connect-email banners; dark recently-viewed rail; store/product feed; floating icon navigation | BUY-001/002; tab destinations, full scroll, banners' actions missing |
| [Saved](https://mobbin.com/screens/b411a6d4-b51c-4da5-9a21-39ea459d98fd) | Collections/create-collection row, two-column saved products, heart controls, promotion badges, back/navigation | BUY-010; creation, selection, removal and empty states missing |
| [Storefront](https://mobbin.com/screens/0f1e8a5c-0dd7-4cdf-a250-61736c9f482f) | Hero/logo/rating, promotion strip, menu/search, Follow/share, category chips, horizontal recommendations, floating back/cart/navigation | BUY-004; follow/search/category/scroll transitions missing |
| [Product](https://mobbin.com/screens/47ce6015-c9bc-4d9b-9460-e43abd7be5d5) | Seller row, large image with next-image edge, title/rating, heart/share, price/promotion, quantity stepper | BUY-005; complete page, options/add, image interaction and unavailable state missing |
| [Cart overlay](https://mobbin.com/screens/f66151c9-42f3-48fe-8ead-6b032b5e1290) | Reduced product page above dark backdrop; seller cart, discount error, item/stepper/save-for-later, promotion progress, subtotal, checkout CTA, separate dismiss control | BUY-006; opening/dismiss motion, mutations, grouping and empty states missing |
| [Reviews](https://mobbin.com/screens/8f0ff393-457f-4e62-98f6-83ea7a968518) | Close/title, rating histogram, search/filter controls, stacked reviews with read-more/helpful/menu | BUY-010; filter/search/voting/reporting interactions missing |
| [Search results](https://mobbin.com/screens/37b59973-75fe-4059-a622-543e6de7ec07) | Query, filter and country/deal/following chips; horizontal seller cards; compact vertical product rows with ratings/prices/seller | BUY-003; entry, suggestions, filters, sort, empty/error and pagination missing |
| [Assistant answer](https://mobbin.com/screens/2c8d44e0-09ab-4362-b8ba-61c7c9aa5dc3) | Photo-based question, text response, horizontal product rails, follow-up composer and close | Source buyer AI; not merchant messaging or MER-010. Scope disposition required, no silent omission |
| [Voice loading](https://mobbin.com/screens/c90189a9-ccc7-47c0-b8ed-ac163265beb9) | Voice header/back/close, tall rounded panel, Almost ready state, speaker/microphone controls | Source buyer AI; permissions, audio, loading/recovery transitions missing; scope disposition required |
| [Order tracking](https://mobbin.com/screens/6b96514b-1c09-4262-b785-385a48c4153f) | Seller/arrival/progress, carrier tracking, order/items, manage/visit/details actions, delivery progress and floating navigation | BUY-008/009; history, management, carrier and recovery transitions missing |

Observed flow anchors for later authorized inspection: [Saved](https://mobbin.com/flows/75b26fee-826f-4403-9288-be499890cd72), [Store detail](https://mobbin.com/flows/ea05a60f-ccf7-427a-97b3-9c2bb9a5674c), [Store information](https://mobbin.com/flows/069d1098-37bd-4600-85ab-28342cf021ad), [Product detail](https://mobbin.com/flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7), [Product photos](https://mobbin.com/flows/0f9653b4-5412-485a-a3a4-62bfb492a27e), [Purchasing](https://mobbin.com/flows/968f374e-69af-4adb-b913-0bb5c0e5e8b1), [Cart deletion](https://mobbin.com/flows/c5c9c07b-c093-4221-a2f8-44ca7c29ded0), [Product reviews](https://mobbin.com/flows/4e59dce2-d2a0-4f4e-ae16-54267243df75), [Search](https://mobbin.com/flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c), [Filtering](https://mobbin.com/flows/0344c453-dece-4e8d-bb54-68f6e551b83f), [Assistant](https://mobbin.com/flows/d6910bbb-655d-44ad-842e-11da062a1e66), [Voice setup](https://mobbin.com/flows/2f492f6c-2db7-440b-8515-aa56a2d029e5), [Order tracking](https://mobbin.com/flows/d3bf7c94-4d9e-4298-a255-eaf177f9efd1). These links were visible on screen detail pages; their complete sequences/recordings have not been inspected. Link presence does not establish entry/action/outcome.

### Discovery slice proposed for Task 3

Additional browser evidence: [onboarding introduction](https://mobbin.com/screens/cfb5f163-40cf-438f-a57a-99624e6120a9) renders a white product-collage screen with centered discovery copy, a purple Get Started CTA and terms/privacy text. [Home sequence](https://mobbin.com/flows/8d7a8acd-de80-444e-93ba-65c61d7b6444) exposes six screen images; the first rendered state shows seller shelves, top shortcuts, floating navigation and a Keep going cue. [Filtering results sequence](https://mobbin.com/flows/0344c453-dece-4e8d-bb54-68f6e551b83f) exposes ten screen images; the first two visible states show populated results followed by a dimmed backdrop/filter sheet with deal, sort, category, color, size, gender, price, rating and destination options plus Clear all. These rendered sequence entries are usable source evidence. All 97 flow card entries and 424 ordered flow occurrences are now archived privately; offscreen frames still need visual review, and the 2026-09-09 gallery audit acquired all eight recordings exposed across those 97 cards.

### Private source acquisition inventory (audited 2026-09-09)

Owner-requested GitHub publication (2026-09-09): [references/shop/README.md](references/shop/README.md) describes the public copy containing the 755 canonical media files, offline gallery and sanitized catalogues. Every copied media file was SHA-256 checked against the local archive. Signed download URLs, temporary machine paths and private acquisition logs are excluded. The original `mobbin-shop/` archive stays ignored. This specific publication request does not change the handling of other private evidence or establish visual/source approval.

The browser capture was crawled through ordinary navigation and saved in Git-ignored `mobbin-shop/`, identified by capture `7b6adbde-de48-47c5-979b-f629f1eb87a9`. The exact counts below are acquisition/integrity facts, not source-fidelity approval:

| Source surface | Browser observation and local evidence | Boundary |
| --- | --- | --- |
| Screens | **323/323** ordered screen records; 307 images and 16 videos; every source row has its own downloaded file; no unresolved screen row, duplicate ID/file/hash, or missing order in the local validator | Still images were decoded and media files hashed locally; the complete set has not been visually reviewed screen-by-screen; video playback and motion timing remain unverified |
| UI Elements | **323** virtualized cards link to the same 323 full-screen screen records. The ordinary Filter control exposes 4 groups and 42 labels: Control, View, Overlay and Imagery | No separate UI crop download is claimed. The catalogue's taxonomy is recorded, but per-element assignments/counts were not inferred from the unfiltered screen links |
| Flows | **97/97** catalogue cards; **424/424** ordered per-flow screen occurrences downloaded and decoded, with zero missing orders or unresolved frames | The previously missing review-helpful frame 2 is now present. Repeated source appearances remain separate files in their flow sequence |
| Recordings / motion | The 2026-09-09 browser audit inspected all **97** gallery cards and downloaded all **8** exposed flow recordings (11.0-66.9 seconds). These are additional to the **16** short screen videos. Each recording is saved as `flows/<flow-id>/recording.mp4` and linked in the private index | Nonempty files, MP4 container structure and duration checked; complete playback and transition review remain pending |

Resolution audit: 179 source stills are already 1179/1180 x 2676; 128 source stills use smaller supplied variants. All 128 have close pixel matches among the existing full-resolution flow images, recorded as candidates in private `existing-resolution-candidates.json`; no asset was upscaled, overwritten or downloaded again on that basis. The source screen examined directly (product screen 59) is already 1179 x 2676 despite its stale browser-size metadata. Candidate matching is not visual sign-off. The derived `ui-elements-order.json` is explicitly marked as derived from Screens, not independent UI Elements ordering evidence.

The private indexer reports the source archive, UI Elements taxonomy and Flows catalogue metadata together, while preserving separate screen files and separate flow-occurrence files. The source lists `iOS (393x852)` at the detail-page level, but the downloaded media's raster dimensions are not a substitute for logical content viewport or device-density proof. Web, Android, tablet and desktop differences remain review work, not assumptions.

Scope: BUY-001 through BUY-005 plus local save/add feedback needed to navigate home -> search results or storefront -> product -> back. Include source shell/tab selection, feed scroll, search entry/suggestions/clear/no-results, category/filter/sort sheets with applied/cleared states, store follow/search, product image/options/quantity/stock states and overlay dismissal. Use the canonical implementation with isolated fixtures; later tasks connect persistence.

The source stills above provide candidate component families, not a ready-to-code specification. Before starting Task 3, obtain the missing sequence/state evidence; measure content viewport, type/font, spacing, cards, icon/navigation geometry, colors and overlay behavior; record permitted assets; then review this slice with the owner. Freeze each additional source ID within the same 323-screen capture and account for all screens before Task 6. Buyer assistant/voice are explicit scope decisions for that full capture, not silently excluded because Treido's current AI requirement is merchant-focused.

Proposed platform review: match source content at 393x852; review mobile web at 320/390/430 widths, browser chrome and keyboard/back separately; verify Android safe areas/system back in its actual app; compose tablet/desktop at 768/1024/1440 without stretching mobile screenshots. These are test targets, not inspected source dimensions or approved adaptations. Physical device and motion proof remains necessary. The discovery slice is better source-backed now, but owner/design review of the measured geometry, transitions and platform adaptations is still required before frontend implementation.

### Mobile-web reconstruction plan (owner-directed, 2026-09-09)

The owner explicitly directed implementation of the complete Shop **website at mobile widths in apps/web**, correcting the initial interpretation as Expo. This execution does not change apps/mobile. The instruction authorizes the frontend slices of Tasks 3, 5 and 6 to proceed with isolated reference state before their backend dependencies; it does not mark their real-service requirements complete or approve visual fidelity. Astra agents with low reasoning implement bounded batches; the orchestrator reviews source, coordinates one code writer on shared main, runs browser checks and assigns corrections. No new branch, deployment or paid provider is part of this work.

Implementation uses real DOM, App Router pages, shared visual components and typed state. Source images provide product/brand media only, never whole-screen backgrounds with click targets. Catalog fixtures enter through the existing opt-in server adapter. Account/order fixtures use synthetic personal details. Forms and local transitions are implemented now; absent authentication, OAuth, payment, AI and delivery integrations must remain explicitly unavailable or isolated reference states, with no false service success.

**Measured comparison frame:** inspected 1179x2676 source files normalize to 393x892; app content ends at y852 and the Mobbin footer occupies y852-892. The source iOS status area occupies y0-59. Mobile-web comparison therefore uses the y59-852 content crop (393x793), with no painted status bar or attribution footer. At other browser heights, preserve component dimensions and bottom anchoring, rather than scaling a screenshot. Physical Safari browser chrome, fonts and safe-area behavior still require device evidence.

| Shared visual owner | Initial measured source geometry at 393px width |
| --- | --- |
| Home feed | 16px horizontal gutter; dark rail x16/y271, 361x308; 135px square media cards at x32/175/318, 8px gap |
| Floating navigation | Home/Search/Explore/Orders; x86/y764, 221x56, 32px source bottom clearance; profile is the top avatar entry |
| Product gallery | x16/y119, 361px square, next image edge visible; title/options/quantity follow in normal scroll flow |
| Filter sheet | Large sheet x16/y221, 361x597; short sort sheet y454, height364; action footer y756, height44 |
| Search | Recent/result content scrolls; composer stays above floating navigation; query/filter state and browser history agree |

All y coordinates in the table refer to the source including its 59px status area. Do not add that area back to the website. System sans-serif is provisional on Windows: source font identity and matching iOS font metrics are not established by a visually similar fallback. Exact motion durations remain pending playback review.

The following map accounts for all **97** ordered flow entries in [the frozen manifest](references/shop/manifest.json). Numbers are 1-based catalogue positions, not additional tasks. Each entry's exact flow UUID and ordered files are stored in that manifest; flow frame 001 frequently shows the previous page. Flow occurrence records do not contain a global screen UUID, so use flow UUID plus frame order unless an identical hash establishes a screen match.

| Catalogue flows | Page/component family and transition coverage | Owning task |
| --- | --- | --- |
| 1, 94 | Onboarding/login: introduction, contact/code entry, preferences, return destination; real identity remains Task 4 | 6 |
| 2-6, 42 | Home, notifications, deals, following/feed/list; shelf menu and not-interested state | 3 / 6 |
| 7-13 | Saved grid; create collection, select products, details/ideas, edit name, visibility, deletion | 3 / 6 |
| 14-16, 40-41, 96-97 | Storefront/information/collections/video; store search, filter, follow | 3 |
| 17-20, 32 | Product, gallery, description, options/quantity, save-to-collection, add/cart feedback | 3 |
| 21-31 | Seller cart, checkout, Review & Pay; remove/save-for-later, phone/address/payment forms, selectors/deletion, summary/receipt | 5 frontend |
| 33-39 | Product/store reviews; search/helpful/report, contact shop, report product | 6 |
| 43-44, 48-49 | Search entry/suggestions/results, all filter/subfilter states, recently viewed | 3 |
| 45-47 | Assistant thread, answer detail and feedback; fixture recommendations/composer, no invented live AI | 6 |
| 50-51 | Explore, category detail and product/store destinations | 3 |
| 52-59 | Minis catalogue/setup, Sol voice/text/mute, skin analysis, similar clothes, Gift Sense; captured frontend states and browser permission differences | 6 |
| 60-68, 79 | Orders/list/detail/archive/history; copy number, delivery confirmation/progress, tracking edits, review, manual order entry | 5 / 6 frontend |
| 69-78 | Profile/account/public profile; photo, name, gender, birthday, shoe size, skin condition, people preferences | 6 |
| 80-84 | Payment method list/detail/add/delete; address list/add/edit/delete, shared checkout form owners | 6 frontend |
| 85-89, 93 | Security, notifications, connections/provider return, account deletion and logout | 6 frontend |
| 90-92 | Support, support assistant and About | 6 |
| 95 | Native widget flow: explicit browser adaptation remains unresolved; no web equivalent is silently claimed | 6 review |

**Execution and review:** build one connected family batch, run scoped type/lint and interaction checks, compare its source states at 393x793 plus 320px and 430px widths, then fix the batch together. Verify navigation/back/scroll, focus containment/return, keyboard, form validation, empty/error/loading and reload state where applicable. Broader device/desktop regression retains its existing task ownership. Record actual outcomes in tasks.md. A mapped family, a rendered route or a passing screenshot regression does not constitute full source approval.

**Implemented source work (2026-09-09):** 49 canonical website page routes cover the mapped families with synthetic local reference state. Serialized Astra low-reasoning batches added the seven captured Home campaigns, sticky header/loading state, complete Beauty sections, retained Search suggestions/history, collection invitation/ideas states, source-sized Sol choices/results, Gift and outfit details, five-photo gallery, review/report details, privacy/deletion, Gmail connection, distinct initial checkout forms, saved-for-later cart, White Rock pickup, receipt/confirmation and tracking/activity states. Shared sheets preserve focus/history, distinguish inside padding from backdrop clicks and support measured entry/drag dismissal. Native system chrome is excluded from the 393x793 browser comparison. The website uses the Apple system font stack where available and Arial fallback on Windows; that does not prove exact iOS font metrics. Controls and text are rendered DOM, with clean photography/brand/decorative media only. The product store card's crop ends before seller copy and Follow, which remain interactive DOM.

**Media and remaining differences:** 44 original assets are verified through `references/shop/product-media-provenance.json`; the Home KITSCH wordmark uses the official merchant SVG paths. Shea gallery images 1–3 match the frozen capture; images 4–5 are verified current merchant photographs whose historical positions remain unverified. Six additional Beauty originals and six Home product originals replace partial product imagery. Full campaign backgrounds, Following/Pura/quilt compositions, Dad Hat, What's New hero and Chemical Guys motion remain unmatched. Pura's available clean photographic crop retains the captured modal dimming; unidentified or occluded products are not assigned invented identities. The tracking map uses a source-scale clean fragment, not a fabricated full basemap; six order-deal photographs remain partial. The exact transition between account/login and security frames in flow 85 is unverified; both screens are addressable. Some frozen facts hidden by the dock use attributed current merchant facts. Home fixture variants named "One size" and quantity 12 are adapter defaults, not captured inventory facts. Full iOS font metrics, motion/gesture matching and 97-flow state-by-state acceptance remain unverified. No generated fills, stretched photos, screenshot controls or automatically approved baselines may conceal these differences.

**Measured browser evidence:** the production Home recent panel, floating navigation, full gallery photo and order-review textarea are within one pixel of their recorded source anchors at 393x793. White Rock pickup tabs and location panel were corrected to y124.48 and y304.48 against source y124/y304. Sol choice/result geometry and compact card footer were inspected in the in-app browser. These checks establish those anchors and inspected states, not an unbounded claim of complete pixel parity. Actual batch checks and remaining acceptance are recorded under Task 3 in tasks.md.

**Implementation handoff lessons:** `features/discovery/components.tsx` owns ProductCard, StoreRow, FloatingNav and Sheet; preserve its nested history, focus return and scroll-lock behavior. After consuming a sheet history entry for terminal navigation, use the existing replacement pattern rather than adding a duplicate route entry. Keep Search's single input mounted across entry/suggestions/results: moving it between branches loses focus after the first character. Keep selected variant/quantity visible and intact through cart/save-for-later; use shared account payment state so deleted cards cannot remain selected. Receipt discount rows are informational when already included in the captured net subtotal. Preserve the preview gate before Home's Suspense boundary. Headerless sheets already supply an accessible title; do not duplicate that heading semantically. Fix CSS at the component owner, preserve measured geometry and keep source-specific metadata distinct from synthetic adapter defaults.

### Search pending navigation and photo boundary (remote continuation, 2026-09-09)

Code checkpoint: `947f4c855721bd003fa0208e12aeae43f200bf91`. This extends the incoming Search/filter/model changes without replacing their query matching, nested-sheet protocol or unit cases. Application changes are confined to `apps/web/src/app/search/page.tsx` and the existing discovery Search owner plus `search-loading.tsx` / `search-loading.css`.

**Actual image inspection:** opened the committed [screen 139](references/shop/screens/139.webp), source ID `9b438485-4afa-4307-aaad-3b8cecd9a0c7`, from the frozen handoff archive. Its visible structure is the Jeans query, chip skeletons, two full rounded store placeholders plus a clipped next card, stacked rounded result placeholders, a faded lower row and a status above the existing floating back/navigation dock. This smaller 720x1680 archive variant is evidence of the composition, not a new full-resolution pixel baseline. The 393x793 browser target and OS/footer exclusions above still apply.

**Flow context:** catalogue flow 44, `4d0f0532-ce38-49b5-a94b-32e8ace4716c`, contains six ordered frames and a recording; flow 48, `0344c453-dece-4e8d-bb54-68f6e551b83f`, contains ten filter frames. Their manifest ordering was read, but this remote continuation does not claim new visual inspection of every flow frame, a verified small/full-resolution frame pairing, or recording playback. Screen 139 is the exact visually inspected source for the added pending composition.

**Implemented state changes:** a real React navigation transition reveals the DOM skeleton while retaining the same search input and FloatingNav; there is no artificial delay. Removing the page's query key prevents a query transition from remounting Search. Filter-only results now use the top search field; removing `q` does not revive the old server query. Cancel/Escape returns the field to the accepted query instead of showing an unsubmitted draft over old results. Ordinary suggestion activation uses the same transition while modified link clicks retain browser behavior.

**Truthful service adaptations, not captured-source claims:** the pending label is "Loading results", rather than implying a live AI is "Thinking". A locally selected photo is neither identified as a baseball cap nor silently routed to that cap's captured answer. Submitting it opens an explicit unavailable sheet; the user may remove it or deliberately open the separately labeled captured example. The latter uses Sheet's existing same-origin Link replacement behavior. Existing file validation, object-URL cleanup and shared history/focus/scroll ownership are preserved. No photo upload, AI request or new service integration was added.

No new photography, logos or decorative originals are required for this batch. All previously listed asset gaps remain open. New pending-state geometry, field/dock positioning, font metrics, animation timing, keyboard behavior, nested history and the actual rendered navigation/photo journeys remain unverified at this checkpoint. No build, lint, tests, dev server, browser implementation capture or runtime check was executed remotely; the owner-directed Task 3 exception assigns those to desktop. This is implementation progress, not source acceptance.

### Reviews, reports and store-review continuation (2026-09-09)

Continued the existing website from `425ff6b`, preserving the incoming Search and Saved corrections. This is a Task 3/5/6 frontend correction batch, not another route family or an approved 1:1 milestone. Source images were opened through the connected Desktop, normalized to 393x892 and cropped to browser content `(0,59)-(393,852)` before comparison with the 393x793 rendered page.

| Frozen flow | Frames visually inspected | Corrections / scope |
| --- | --- | --- |
| 33 `4e59dce2-d2a0-4f4e-ae16-54267243df75` | 002 | Product-review heading, summary, histogram, search and card geometry. |
| 34 `b2a75fc0-0d02-462f-8bb7-65ae38d08840` | 001-002 | Captured `nice` ordering, four-star scent review, muted `NC / OS` variant, plain `Nice` body, no unnecessary expansion controls. |
| 35 `36c23a43-49d3-4932-9595-f122062480b4` | 001-002 | Measured text expansion; selected Helpful treatment and local count. |
| 36 `fae1016a-facb-4633-b62b-7ddd809e0fac` | 001-006 | More options, all nine reasons, disabled/selected Report, confirmation and dimmed reported-review state. |
| 39 `2d948785-52f0-49dd-985e-4a016ced6ae2` | 001-002 | Store-review summary, black/half stars, 63px thumbnails, avatars, filter rail, card surfaces and captured excerpts. |

Flow 38 `82159116-18bf-4988-9acd-0f1bb1f76a0f` frames 001-006 were also visually inspected to preserve the adjacent product-report journey. Its ProductOptions implementation was not changed or newly accepted. No recording or motion parity is claimed by these still-image comparisons.

Implementation owners: existing `discovery/reviews.tsx`, `store-reviews.tsx`, `icons.tsx` and their existing rules in `app/globals.css`; shared review-only rendering/feedback in `review-feedback.tsx`; pure selection in `review-model.ts`. The shared Sheet, Search, Saved, cart, checkout and account-payment owners were not modified. Stars have a review-specific class to avoid the existing commerce `.review-stars` styling. Report stages retain one Sheet and its history/scroll-lock owner; stage focus moves to an actual control without reopening that Sheet.

Behavior and boundaries: keyword entry retains one mounted field; expansion survives query filtering; real record ratings drive display/filter/sort; Most helpful uses only page-local selections. Search-only captured records remain outside the default source slice but participate in explicit matching/sorting. The guessed capture-date anchor was removed: known absolute dates have a declared fixture ordering, while undated/relative records retain source-order fallback, not a fabricated timestamp. Empty-result recovery and filter details are browser adaptations, not additional source-certified frames. Existing synthetic reviewer identities remain unchanged, and incomplete store excerpts do not invent hidden continuation text.

Reporting preserves the captured form sequence but does not submit to a provider. The confirmation explicitly says that the selection is marked on this page only and no report was sent; marked cards retain a local-preview label. Report/helpful state is not persisted account data. Moderation, messaging and other live services remain unavailable. The review font owner retains Apple system fonts first and the existing Shop Arial/Helvetica fallback; this is not proof of source font metrics, a newly acquired font or approval of every text wrap. Store surface colors were sampled from the frozen frame; no screenshot is used as interactive UI.

Observed developer-browser inspection: the owner's final instruction in this continuation permits the opt-in dev preview on port 3101. Installed Chrome rendered the product/store review pages at 393x793. Search/card top anchors are y176/y236; sequential `nice` entry retained the same focused input; the four-star row and conditional expansion rendered. Expanded Helpful/report selection reached the explicit local confirmation. Browser Back closed the report Sheet and restored its original More-options trigger. A 320px picker inspection demonstrated scrolling to the last reason with Report still available, before the final cosmetic refinements. Store Most helpful moved the selected second review first; selecting four stars produced a real empty sample, and Clear filters restored three cards. These are limited developer-browser observations, not a production gate, automated test suite, physical-device result or full source approval.

Evidence remains ignored locally in `.local/shop-build/review-continuation/` (normalized source contact sheets, before/refined browser captures). Source formatting was applied as editing, but no build, lint, typecheck, formatter check or test suite was run. Fourteen synthetic cases were added in `review-model.test.ts` and remain unexecuted. Earlier desktop acceptance evidence elsewhere in this document does not certify this batch.

Remaining: final source-font/text wrapping, complete transition/gesture matching and cross-width/physical-device acceptance are unverified. Store filter/report reuse and empty states need owner review where no corresponding inspected store-state frame proves them. No new media was acquired or required for this batch; all previously recorded campaign/Following/Pura/quilt, Dad Hat, What's New, Chemical Guys motion, tracking basemap, order-deal photography and Shea gallery-position gaps remain open. Full 97-flow acceptance is still outstanding; Tasks 3/6 remain Review and Task 5 remains incomplete.

### Product, gallery, save and cart-offer continuation

Continued on `main` from `6bfc2a9` using the same canonical website. The 3101 preview was confirmed running before edits. All referenced stills below were opened from the frozen archive, normalized to 393x892 and cropped to `(0,59)-(393,852)`; no current Shop capture or whole-screen UI image was substituted.

| Frozen flow | Inspected evidence | Implemented scope |
| --- | --- | --- |
| 17 `a99e7161-595d-466c-b0b1-bc1183f1d4d7` | 001-009 | Product quantity boundaries, saved-heart treatment, anchored navigation; surrounding details inspected, not blanket approved. |
| 18 `0f9653b4-5412-485a-a3a4-62bfb492a27e` | 001-003 | Full-photo selection, pointer/keyboard navigation, bounded ends and return to the viewed photo in the underlying gallery. |
| 19 `300d3e11-4ba4-4c43-b720-a7132c6eb7f5` | 001-003 | Save on picker entry, grabber/rows/heart, collection membership and creation return, Item saved feedback. |
| 20 `9211553e-bc3c-45f9-943b-f032766e6799` | 001-003; recording sampled at 0/2/4/6/8/10 seconds | Bag Add to cart enters the existing offer, with its net amount, captured comparison, grid, progress and cart footer. |
| 37 `6b220d0d-825a-477b-b42f-2e2330f6b8bb` | 001-003 | More options and Contact KITSCH sheet geometry, left-aligned contact actions, source-shaped icons and clipboard feedback/recovery. |
| 38 `82159116-18bf-4988-9acd-0f1bb1f76a0f` | 001-006 | Reason/notes form, retained values, disabled Next, local marking and return to the store product grid with its compact navigation. |

Flow 32 `1dc39cc8-951e-4207-96a5-296145053e26` frames 001-002 were also opened; description content was not changed or newly accepted. Recording sampling establishes the visible intermediate Add/Buy/cart/offer states, not an exact trigger time or complete motion review. The bag's local cart update is synchronous and opens the offer without simulating the recording's network delay. Keyboard navigation, non-looping ends and the 40px horizontal-swipe threshold are explicit browser adaptations, not inferred native gesture specifications.

Existing owners were extended: `discovery/product.tsx`/`product.css`, ProductOptions in `reviews.tsx`, `store.tsx`, `components.tsx`/`icons.tsx`, CartOffer in `commerce/checkout.tsx`, its existing styles in `account/account.css`, and `commerce/pricing.ts`. Pure gallery navigation lives in `product-gallery.ts`. No route, second frontend, provider SDK or architecture was added. Sheet's history and scroll-lock protocol is unchanged; its existing focus return is preserved with the removed-trigger recovery described below. IconButton only gains an optional disabled prop; FloatingNav keeps its central position while independent Back/cart controls appear, derives the displayed cart quantity from shared local state and hides the empty cart control.

The same mounted photo viewer now returns focus and horizontal gallery position to the selected photograph without scrolling the document vertically. Product quantity controls enforce their declared fixture bounds. Ordinary Buy now pushes checkout so browser Back returns to the product; an owned Sheet transition retains the existing consume-and-replace pattern. Bag Add to cart retains its captured label, enters the offer and avoids the former extra inline offer row. The offer uses the existing `capturedLineAmount` rather than the undiscounted catalog amount: the default bag has a $3.65 local net amount and a $46.35 remaining threshold. Its visible $6.35 strike-through is separately recorded from flow 20/003 as display-only reference data; it is not subtracted again, applied to unknown variants or presented as a live merchant price.

Cart deletion flow 22 `c5c9c07b-c093-4221-a2f8-44ca7c29ded0` and save-for-later flow 23 `07f5c915-d967-4ef4-89f7-e08ac90c974c`, frames 001-002 each, were also visually opened. They confirm the cart's $5.00 catalog amount / $1.35 discount / $3.65 net, distinct from the offer's historical comparison label. No cart-line, reservation or save-for-later transition was replaced. Hiding an empty cart control exposed a real focus defect: closing the emptied cart left focus on `body`. Sheet now falls back to an existing parent sheet control or the active navigation link only when its original trigger has been removed and the route has not changed. Its history registration, replacement, pending-Back handling and scroll-lock protocol are untouched.

Product reporting remains local: the form preserves the chosen reason and notes through Back/Next, and its terminal route replaces the consumed overlay entry. The store scrolls to `#all-products`, marks only an actually locally reported product and renders `Item marked · no report sent`; adding a query parameter alone cannot fabricate that state. The compact store bar uses the visible 20%-off label and truncated coupon from frame 38/006. Its details explicitly cannot validate/apply a coupon; neither a complete hidden coupon nor live promotion synchronization is inferred. The Shop-all thumbnail now reuses the already-provenanced Air Dry Cream original rather than a rice-shampoo crop.

Measured 393x793 content anchors after this batch: More options `(16,579,361,180)`; Contact `(16,351,361,408)`; reason form `(16,385,361,374)`; notes form `(16,422,361,337)` with action row y697; save picker `(16,611,361,148)`; Item saved toast `(16,629,361,60)`; full photo `(0,170.5,393,393)`; floating main navigation `(86,705,221,56)`; compact store bar height98 with product grid y152.89; bag offer `(16,120,361,639)`. These are the inspected anchors, not a whole-screen pixel-diff pass or source approval.

Browser observations (Chrome 151.0.7922.175, device scale1): keyboard first/last photo navigation remained bounded; selecting photo 2 and closing returned the rail to x369, focus to its second photo control and document scroll to y0. Ordinary Buy now and offer-to-checkout returned to the product with browser Back, without reopening an obsolete sheet. Product-report forms at 320/430 widths had no document overflow, retained an accessible action footer, and Back closed the sheet and restored More options. A newly created collection appeared in the existing picker. The nested cart offer closed back into its parent with the body still locked and focus on Add items; save-for-later/restoration retained quantity 3; removing the final line then closing restored Home focus and released the lock. Clipboard recovery was implemented but an actual OS clipboard permission transaction was not exercised.

A fresh 393px bag -> offer -> checkout and product -> report -> store sequence recorded no page/console errors or HTTP failures. One earlier console 404 during the editing/refresh session had no retained URL and was not reproduced; it is not represented as a resolved defect. Inspector-only selector/hidden-element ambiguities were corrected separately from app code. No build, lint, typecheck, formatter check or test suite ran. Source formatting was applied as editing; 14 gallery cases and four reference-pricing cases were added under `apps/web` and remain unexecuted. Earlier suite results belong to earlier commits.

**New precise media requirement:** the `rice-shampoo` media entry still comes from `screens/130.webp`, rect `[16,179,44,44]`, which is visibly insufficient for the store grid. Acquire the clean original Rice Water Protein Solid Shampoo Bar pack/bar photograph matching flow 17/001 and flow 38/006, without heart/control overlays, at least 525x525 pixels (preferably the merchant's full original). Intended ignored file: `reference-assets/shop/products/rice-shampoo.jpg`; its acquisition must record source page/download URL, SHA-256 and dimensions before the media alias is changed. No new asset file, guessed URL, generated fill or substitute photograph was added in this batch.

Remaining source differences include the existing campaign/Following/Pura/quilt, Dad Hat, What's New, Chemical Guys motion, complete tracking map/order-deal photographs and Shea 4-5 historical positions, plus the newly identified rice-shampoo original. Full source font metrics, fractional product-card star/icon matching, remaining product/store copy geometry, promotion changes between captured states and complete motion/gesture matching remain open. Small-width and developer-browser observations are not physical Safari/Android evidence. Full 97-flow acceptance is still outstanding; Tasks 3/6 remain Review and Task 5 remains incomplete. Local evidence is retained in ignored `.local/shop-build/product-continuation/`.


### Store search and filtering continuation

Continued from `bd3b003` using the same frozen capture. Actual flow images were opened at 393x793 content coordinates, not substituted with a current Shop capture. `store.tsx` still owns storefront/search/filter components; `store-model.ts` now provides the shared local query/filter projection used by the controls, grid and result count. The existing Sheet implementation and history/query protocol are unchanged in this batch.

| Frozen flow and frames opened | Corrections and boundaries |
| --- | --- |
| 40: `1df75dd0-05f6-445c-9709-0e0bda2df3af`, 001-004 | Store-search entry, persistent input, suggestions/keyword emphasis and results geometry; merchant-scoped suggestions, accepted-query Cancel/Back and empty recovery. The exact default `shampoo` view retains the captured 270 count with an explicit sample explanation; changed criteria use the actual local matching count. Only four result products are identified in this projection, not 270 working records. |
| 16: `85a58afb-b3e8-4f69-b274-69762b09ffbf`, 001-005 | Main filter rows, checkboxes, price sheet, 24px handles and selected-range track; working minimum/maximum, Reset, Done, reopen and nested Back. Direct toolbar subfilters no longer create a hidden parent entry. Price Reset preserves unrelated criteria/query; sort Reset resets only sort. |
| 14: `e85d0150-4fe9-4ee0-bde4-de17fe6da7df`, 001-003 | Adjacent collection context inspected. Shared filter corrections apply there; collection hero, first-collection invitation and complete collection fidelity were not newly completed or accepted. |

At 393x793, observed browser anchors after correction: entry field x16/y4, 286x44; recent photo x16/y192, 112x112; first Best sellers photo x16/y360, 112x112. Suggestions use 44px tiles from y64 in 56px rows. Results controls start x16/y56 and the first image row y136. The Price dialog is x16/y333, 361x426, with bottom y759; track centers x60/x333 at y566. Pointer-dragging the upper handle to x112 produces $380, matching frame 004. The unused track is transparent: source pixels at x200/280/333, y566 are white in that frame. These anchors do not approve font glyphs, imagery or every pixel.

Behavior: one mounted input survives entry/suggestions/results and sequential typing; store identity, not the query, is its route key. Cancel during editing restores the accepted query. Submitted searches add browser history without remounting the field; Back restores the preceding accepted query. Query text and product/category matching are normalized and scoped to the current store; another merchant no longer receives KITSCH's products/categories by default. Empty searches/filters have recovery without substituting unrelated products. Native browser adaptations include keyboard-only Clear search, ordinary form submission/keyboard dismissal and history restoration; native keyboard/gesture timing is not claimed.

Filter inputs and results use one sanitized projection. Non-finite/reversed/out-of-range URL bounds recover deterministically, and URL values use the existing preview sliders' ten-dollar step. The $2,000+ endpoint is open-ended, not an accidental hard cap. On sale requires an evidenced higher comparison price in the same currency; In-stock uses actual fixture variants. Best selling/Featured retain the supplied source order, not invented rankings. The source's selected-sale backdrop is not proven equivalent to the limited local sample, and no discount eligibility or comparison prices were invented to preserve that background.

Remaining media requirement extends the previously recorded rice-shampoo original gap: acquire clean, complete originals for `rosemary-liquid`, `rice-liquid` and `detox-shampoo`, with source-matching composition. Flow 40 frame 004 shows the target photo canvases at content rectangles [201,136,175,175], [16,386,175,175] and [201,386,175,175]; rice-shampoo uses [16,136,175,175]. Current media definitions respectively use narrow 72x149 / 70x160 photographic fragments and a 41x41 suggestion thumbnail; rice-shampoo uses a 44x44 thumbnail. Those are not full-resolution square originals. Target at least 525x525 for these 3x-density canvases, with public original URL/hash/dimensions and matching provenance. The reference photo rectangles contain interactive heart overlays and must NOT be acquired as replacement screenshot media. No new originals, synthetic photo fills or source-screen controls were added in this batch.

The fourth Best sellers edge and further shampoo result rows remain unidentified/unimplemented, rather than repeated or invented products. Existing star/icon/font differences, incomplete merchant photography, storefront backdrop/scroll/promotion differences and full motion/97-flow acceptance remain open. Evidence is ignored under `.local/shop-build/store-continuation/`; actual browser observations and unexecuted regression cases are recorded in Task 3. No source/brand approval or real search service is claimed.

### Saved and collection source continuation

Source inspected: all 27 ordered stills across flows 7–13 in the frozen capture: `75b26fee-826f-4403-9288-be499890cd72` (001–004), `b74ee3f5-005d-40d3-9466-f6d080f62b40` (001–007), `a3ff00dc-6536-4966-89ae-2af61582d347` (001–003), `972c6dae-9ab4-4aaf-9f21-999808493dc6` (001–002), `c01a7936-24cd-44fb-97fc-a25302b0a2cf` (001–005), `bd9d1905-9b47-445b-805f-0dcc71b59427` (001–003) and `bca3a9c6-3340-4b93-881d-ee1a26c2b26a` (001–003). Full-resolution images were opened and normalized to the existing 393×793 content frame; this is still-image inspection, not motion or owner approval.

`features/discovery/saved.tsx` remains the canonical Saved/collection implementation; its old duplicate global styles now have one owner in `saved.css`. Corrected library card/copy geometry, selection-only image actions, plus/check states, selected-thumbnail toolbar, newest-selected member order, create/edit forms, visibility/share states, per-collection invitation dismissal, menu/confirmation rows, featured-brand geometry and empty recovery. The KITSCH featured square reuses the already-provenanced official vector rather than magnifying a circular avatar. The empty socks crop now contains the complete photograph at its measured size; no screenshot button or screen background is used.

Source anchors at 393×793: library create tile x16/y88, 361×202; saved media starts y322; add/ideas media starts y66. Options sheet x16/y455, 361×304. Creation editor is 202px high above the existing browser bottom clearance; edit editor is about 314px. The source keyboard is excluded, not painted into the page. At 320/430, creation stays within 16px gutters; longer confirmation copy wraps rather than clipping actions. The confirmation’s publication promise is deliberately replaced by a visible local-only explanation, and actual share/invite actions remain unavailable.

Selection navigation uses the same Next public History API as the existing implementation, consuming an options-sheet entry before replacement. Done/Back from existing collection selection returns once to its parent; creation replaces its temporary selection view with the new detail. Selection starts at scroll zero and returns to its actual entry scroll/focus (381px observed in the nonzero-scroll journey). Browser Forward can recover the stored return position. The existing Saved membership reducer, cart variants/quantities, shared payment state and Sheet protocol are retained. Deleting a collection leaves globally saved products intact.

**Original photography:** eleven complete KITSCH originals replace undersized/narrow crops for rice shampoo, detox shampoo, rice/rosemary liquid shampoo, the five identified More ideas products, the Jojoba photograph and the captured Argan liquid pair. The existing canonical [product-media-provenance.json](references/shop/product-media-provenance.json) now records 55 acquired originals, including their exact public merchant/CDN URLs, SHA-256 hashes, dimensions and relevant frozen flow/frame. Files remain ignored under `reference-assets/shop/products`; the unchanged `prepare-shop-reference.mjs` reads the expanded manifest. No runtime remote fetching or new acquisition system was introduced. The source More ideas photograph treatment is measured narrowly at its card owner; raw originals are unchanged. The Argan bar-pair candidate did not match and was not integrated; the actual liquid pair was visually matched instead.

The complete Jojoba image is now available, but its frozen price/product record is still not established: its plus control opens an explicit unavailable explanation rather than inventing a price. Later Saved/collection frames include additional previously saved products; this batch does not silently inject those into the initial saved state. Source fonts, some photograph color/rounding details, the remaining external imagery, native keyboard/device motion and complete 97-flow acceptance remain outstanding. Form/layout corrections and decoded originals are not a blanket 1:1 claim. Actual browser evidence is ignored under `.local/shop-build/saved-continuation/`.

## 4. Components and interaction rules

Derive scales for spacing/type/radius/colors/icons/shadows/motion from inspected source. Shared tokens are platform-neutral; web and native have their own components. One canonical implementation per visual role per platform. Use needed primitives rather than a universal card with dozens of historical flags.

Specify each complete flow's loading/error/success/direct-link behavior; browser/native back; dismiss/Escape; scroll locking/restoration; focus containment/return; keyboard/safe areas; nested sheets and form persistence. Product direct links work without an originating feed. Record whether tab switching restores scroll/navigation state. Payment return resumes its existing operation, not a new checkout.

Use recordings for motion where available; still images cannot prove timings or gestures. Respect reduced motion, readable contrast and semantics. Correct styles in their owning component/token, not global shadow/blur/class-name overrides or blanket !important patches.

Build related components/screens as one batch. Inspect and refine while working, then run the task's screen-set review and focused checks at the batch end. There is no mandatory full-suite or owner approval after each small component edit.

## 5. Source review at Task 6

First compare implementation with the authorized source at matched logical content dimensions and named exceptions. Only then approve our own regression baselines. Matching our previous output alone does not establish Shop fidelity. Masks cannot conceal meaningful differences; blanket pixel thresholds cannot excuse changed geometry or navigation.

Task 3 records discovery feedback; Task 6 reviews the whole frozen scope, related flows and declared platforms as a batch. The owner/design reviewer records approval, commit, evidence and accepted deviations. The implementation agent does not self-approve. A homepage screenshot does not approve checkout, accounts or native behavior.

Task 5's real transaction must already work. Visual review can separately accept an explicitly fixture-driven communication state, but cannot claim its service works before Task 9. Missing source/device evidence remains Review/Blocked for that scope. Record approval in tasks.md with source details here; do not create competing status ledgers.

## 6. Treido adaptation at Task 7

After recorded source approval, apply Treido identity, owned imagery, approved food labels/categories, seller/producer terminology and required commerce copy through the accepted components. Keep their geometry/navigation unless the owner approves a deliberate adjustment. Product and Category remain technical concepts; a display-label change is not a schema rewrite.

Color-role intent: green for brand/primary actions; yellow for approved highlights; red for error/destructive and explicitly approved brand accents. Exact values, neutrals, focus/contrast/disabled states and any type change require review in this phase. Do not guess them during source implementation or copy an old override stylesheet.

Task 2 supplies food hierarchy and quantity/publication facts. Give units, package sizes, minimums, fees, seller grouping and pickup/delivery an explicit placement; never hide authoritative information for a screenshot match. Check long BG/EN copy and real food images.

At the batch end recheck the full adapted screen set, interaction/transaction regressions, accessibility and relevant performance. Remove Shop marks/names and restricted/reference-only data/assets from release paths. Keep comparison history in authorized evidence/Git history, not another shipping frontend. Brand approval is separate from the remaining service/dashboard completion.

## 7. Merchant and administration

Task 2 proposes operational navigation and representative screens from product.md: business context, listing drafts/publication, stock, order queues/recovery, finance, inbox, team and platform review. Tasks 4-5 build initial publishing/order operations; Tasks 8-11 complete the workspaces.

These are new screens with explicit review, not automatic copies of an old dashboard or forced adaptations of buyer cards. Desktop supports operational density; mobile web supports usable forms and urgent operations. Share primitives/tokens where useful, not one huge shopper/merchant shell. A native handoff to the web dashboard is not native merchant parity.

### Operational presentation proposal (DEC-001/003, awaiting review)

Merchant desktop: persistent business selector and role-appropriate navigation; primary work area with queue filters, selectable rows and a detail/editor panel. Mobile web: compact business/title header, accessible navigation drawer, one queue or editor at a time, explicit back and persisted unsaved form state. No placeholder sales charts. Review representative populated/empty/error/forbidden states before implementation.

| Workspace navigation | Representative screen/state | Required action or evidence |
| --- | --- | --- |
| Overview / Начало | Attention queues: orders awaiting acceptance, low stock, failed fulfillment | Every count links to the exact filtered records; zero and unavailable differ |
| Catalog / Каталог | Draft editor, validation failures, published/archived list | BG/EN content, category/variant/media/unit sections; explicit publish summary and actionable field errors |
| Inventory / Наличности | On-hand/reserved/available, location/lot/expiry detail | Adjustment with reason and history; reserved stock cannot be edited away |
| Orders / Поръчки | Queue by commercial/payment/fulfillment state, order detail | Purchased snapshots, seller allocation, permitted next actions, repeated-action recovery |
| Fulfillment / Изпълнение | Pickup/delivery methods, windows and exceptions | Eligibility/capacity/fees shown from configured records |
| Customers and Inbox / Клиенти и Съобщения | Permissioned customer context and conversation | Unread/failed/retry states; durable service delivered in Task 9 |
| Finance / Финанси | Sales/refunds/fees/settlements with date filters | Drill to ledger/order evidence; unknown costs produce unavailable profit |
| Store / Магазин | Public identity, location/content preview | Preview and publish authorization; suspended-state explanation |
| Team and Settings / Екип и Настройки | Invitations/roles, business settings, Premium entitlement | Revoked membership clears context; financial/team actions require appropriate role |

Platform administration uses a separate permissioned shell: Businesses/verification, Catalog/moderation, Reports/reviews, Support/orders, Payments/reconciliation, Partners/dispatch, Promotions and Access/audit. Its default view is assigned or actionable queues. Representative review includes a business awaiting information, listing rejection with reason, an order with payment/refund mismatch and an operator denied a privileged action. Every exceptional write identifies the resource, reason, before/after state and audit record; refunds remain the canonical commerce command. Merchant status and operator authority are distinct.

Desktop/mobile layouts, exact density and navigation grouping above are proposals; no rendered operational design has been approved. Product requirements remain authoritative if later visual review changes the grouping.

## 8. Assets and review evidence

Keep restricted screenshots/recordings/fonts in authorized private or ignored local storage. Public Git can contain source URLs and nonsecret measurements/evidence IDs, not credentials, signed downloads or restricted collections. Preserve applicable licenses for permitted reuse.

Sanitized synthetic-data screenshots of our own UI can be regression artifacts when no restricted images/private data appear. Otherwise record a private evidence identifier. Keep source and implementation captures, interaction evidence when needed, browser/device/version, viewport/density, locale/fixture, commit and reviewer result. Stabilize fixture time/media/fonts rather than auto-accepting noisy comparisons.

[Playwright](https://playwright.dev/docs/test-snapshots) documents regression mechanics; [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/) documents the native environment. Neither replaces actual source inspection or the owner's review.