# Frontend engineering

Read [architecture](../architecture.md) for dependency boundaries and [styling](../styling.md) before any rendered change. These rules apply to new/touched code; they do not authorize a bulk rewrite of every inherited component.

## Server and client

Pages/layouts are Server Components unless they need browser interaction. Keep data access and private decisions server-side. Put `use client` at the smallest useful interaction boundary: a gallery controller, filter control, form, sheet or optimistic button. Do not mark a whole route client-side merely to use one hook.

A client entry makes its imports part of the client graph. Server-rendered children can still be passed into a client provider; wrapping `children` is not proof that every descendant is a Client Component. Inspect actual imports and browser payloads. Pass only the serializable data the island needs, not database rows, provider responses, a whole `Catalog`, or private fields hidden by CSS. [Official component guidance](https://nextjs.org/docs/app/getting-started/server-and-client-components).

Keep route files thin: parse route input, call a bounded query, handle not-found/redirect, compose UI. Use async request APIs according to installed Next docs. Server queries call their data layer directly rather than fetching the app's own HTTP routes. Do not introduce blanket `connection()` calls or make every route dynamic without a reason; current reference replay behavior is not product caching policy.

### Product-detail boundary

`readProductDetail(id)` returns an explicit `ProductDetailPageView`, not a `Catalog`. Runtime allowlists cover the item, seller identity/policy-availability flags and at most four recommendation cards, including nested money/options/reviews. Reference reads preserve scenario precedence without constructing the aggregate catalog; fixture modules still load, so this is not a single-record database-I/O claim. Adapter failures propagate rather than becoming sample success.

Cart lines and collection covers use a separate bounded context. The current item is reused from detail instead of serializing its variants twice. Browser-restored IDs go through the validated product-context endpoint in batches of at most 100. Responses are `private, no-store`; aborted/stale requests cannot replace the current page. Failed reads keep the same sheet open with explicit retry feedback. The cart remains a local simulation, not inventory or checkout authority.

Gallery motion/focus, saving stages, price presentation, content, delivery, seller recommendations and informational sheets have separate owners. Preserve their DOM, CSS, focus, history and scroll contracts.

## State ownership

[Journeys](journeys.md) defines the full buyer/seller/account paths; [categories](categories.md), [API](api.md) and [assistants](assistants.md) own their data rules. Reuse the accepted product and shared seller presentation. New selling, business, boost and assistant states are bounded extensions using existing typography, forms, sheets and navigation; no parallel marketplace theme.

| State                                                      | Owner                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Search, filters, seller browse kind, sort, cursor          | Validated canonical URL                                         |
| Published listings, saved records, roles, orders, messages | Server/database                                                 |
| Draft form edits before acknowledged save                  | Local form, with server draft/revision for recovery             |
| Open sheet, gallery index, hover/focus, transient input    | Nearest component                                               |
| Non-sensitive recents/return state                         | Bounded browser state when useful, with deliberate lifetime     |
| Pending server mutation                                    | Action/form state and optional reversible optimistic projection |

Do not use one global context for identity, orders, account details, discovery and UI toggles. Split by lifecycle and real consumers as touched. Preserve the current account simulation in reference mode; replace its product behavior with authorized queries/commands. The reference cart uses session storage and is not a server inventory record.

Effects synchronize external systems; do not use them to calculate derivable render values, mirror props unnecessarily or implement avoidable waterfalls. Cancel/ignore stale async responses. Subscription hooks need stable cleanup and deterministic server snapshots. Measure before introducing memoization, React Compiler or an additional client query/store library.

## Components and TypeScript

Use descriptive feature names and kebab-case files, PascalCase components, `*.server.ts` for server modules and `*.test.ts` for colocated logic tests. Prefer named exports except framework-required route exports. Keep types near their owner; share through `packages/contracts` only when more than one runtime needs them.

Extract by responsibility, not arbitrary line count. A route view can compose `ListingGallery`, `ListingSummary`, `SellerSummary`, `ListingActions` and small sheets while preserving the same DOM and CSS. A generic mega-component with many boolean flags is not modularity. Do not create a reusable framework for one form.

Keep strict TypeScript. Use `unknown` at untrusted boundaries and validate; do not solve errors with blanket `any`, non-null assertions, type suppression or disabled build checks. Represent lifecycle/result variants as discriminated unions. Validate money, URLs, dates, IDs, enums and limits at the server boundary even when client validation already exists. Comments explain invariants and non-obvious reference constraints, not restate syntax.

## Forms and mutations

Signup asks what the human wants to do, with skippable/editable Buy, Sell personal items and Set up a business intent. A separate current-authority seller switch selects personal/business operations. The URL-owned browse control is one current-scope pill in the horizontal Home shortcut row or existing Search filter strip. Its sheet offers All sellers, Personal and Businesses with the current choice checked; neither control implies new condition, verification, warranty or paid status.

Category forms use the versioned leaf/attribute registry, progressive fields and honest required/unsupported states. Unique and stocked variant/quantity inputs respect seller/leaf capabilities. Imports show row errors and create recoverable drafts; they do not bypass normal publish. Checkout groups sellers/currencies and shows authoritative quotes for every line; stale stock/offer/payment states return structured recovery in the same flow.

Minis keep the existing gallery/assistant language and become the seven named tools in [assistants](assistants.md). Show editable constraints, source listing cards, known totals/missing facts, budget/exhausted state and cancel/retry. A proposal to save a search, draft a message or edit a seller draft uses ordinary reviewable commands. Never display a model response as confirmed purchase/publication or silently substitute captured answers.

Validate gently on the client for feedback, authoritatively on the server for correctness. Use accessible labels, described errors, visible pending state and retryable failures. Preserve user input when a request fails. Map structured error codes to UI; do not expose internal exceptions.

Prefer Server Actions for web-owned commands and `useActionState`/form status when appropriate. Every command checks current actor/resource/seller authority. Optimistic saves/follows can roll back on failure; never optimistically confirm payment, ownership, verification or final stock. Double-click prevention is UX, not idempotency.

## Routes, loading and assets

Add focused `loading.tsx`, `error.tsx`, `not-found.tsx` where their route families need them; preserve existing component-level skeletons and Suspense behavior. Do not swallow framework redirects/not-found in generic catches. Handle not-found before streaming when HTTP status is material; verify the actual response.

Public listing pages need accurate metadata, canonical URLs and supported structured data derived from real eligible records. Do not index reference pages, private areas or every filter combination. A later SEO task defines canonical/index rules and pagination, rather than removing `noindex` everywhere.

Keep image dimensions/aspect ratio and existing crops; introduce image optimization only with verified visual and payload results. Allowlist remote media sources; stage uploads privately. Use owned/licensed fonts and stable fallbacks. Lazy-load genuinely optional heavy client features rather than critical above-the-fold content.

## Buyer language and location

The shared `features/locale/` boundary uses next-intl with typed BG/EN catalogues and the existing `?lang=` URL contract. An explicit supported language wins, then the saved locale cookie, then weighted browser preferences. With no supported preference, a Vercel country hint of BG selects Bulgarian; otherwise English is the international fallback. Root HTML, private seller pages, Sell and Studio consume the same request locale. Adding a published language requires actual translations and reviewed UI, not an option that silently serves English.

The public Language & location page now works outside reference mode. Its Server Action persists the explicitly selected locale, country/territory, city/area and display time zone in bounded HTTPOnly preference cookies. These are browser preferences, not synchronized account-profile data. Public navigation keeps its existing URL filters; private seller returns keep seller identity, query and pagination without importing public location filters. Country choice is not an allowed delivery market, currency conversion, seller authority or delivery address.

Vercel IP headers provide optional approximate country/city suggestions only on that host. A user can apply the suggestion or enter a location. Device lookup starts only from the informed button and normal browser permission flow, then calls BigDataCloud directly from the browser with the current device coordinates. Denied/unavailable/timed-out requests preserve manual entry; cancellation discards late responses. Treido stores only chosen country/city, never device coordinates. Production IP detection and real-device provider response require their deployed/browser environment; tests must not send synthetic coordinates to the free provider.

Country identifiers and BG/EN labels are checked-in Unicode CLDR data with the bundled Unicode license. The same labels and ordering render on server and browser: differing host ICU releases must not cause hydration drift. Keep money, dates, plural counts and time zones explicit. Seller names, addresses, descriptions, policy drafts and other user-authored content are not blindly translated. UI captions and canonical option/status values stay separate; translated labels never drive authorization, badges or icons.

Buyer/root and Studio messages remain separately owned. T36 extends BG/EN catalogues across discovery, product/detail/review controls, cart/checkout/orders, account/onboarding/help, and merchant catalogue, customer, order, marketing, content, reporting and workspace screens. Explicit canonical captions translate options and status labels without changing stored values; ICU messages carry counts and interpolated names. Money keeps the listing currency while using the selected locale. Seller-authored titles, reviews, addresses and original artwork remain original content, not automatically generated translations. Native Expo is outside this web implementation.

The first-visit language suggestion is a compact black control positioned 12px above the actual buyer dock. It opens the existing Sheet interaction with BG/EN radio choices and an explicit apply action. Saved preferences suppress the suggestion; dismissal is remembered for 30 days. It is hidden behind other dialogs and excluded from checkout, seller/admin and authentication routes. The same picker remains accessible in the Profile footer. Changing language retains search filters and location, restores focus on cancellation, and uses the existing overlay history owner for Back. Country/location settings remain a separate explicit form, now linked from the language sheet without losing the originating search. The suggestion hides during text entry and while search suggestions own the screen, and route changes discard the old picker.

T37 also carries the validated language through sign-in/signup links, post-login return paths and private seller recovery. Embedded Clerk UI receives the selected official Bulgarian/English dictionary from `clerkLocalization` on the server; no auth appearance is changed. These dictionaries do not configure the external Account Portal or email/SMS templates. See [Clerk localization](https://clerk.com/docs/guides/customizing-clerk/localization).

References: [next-intl App Router](https://next-intl.dev/docs/getting-started/app-router), [Shopify localization](https://help.shopify.com/en/manual/markets/getting-started/localization), [Vercel location headers](https://vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions), [BigDataCloud client lookup and fair use](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api), [CLDR country names](https://github.com/unicode-org/cldr-json/tree/main/cldr-json/cldr-localenames-full).

## Visual owners and integration seam

Before rendered work, select BUY or STU ownership from [UI patterns](ui-patterns.md). Preserve the accepted DOM/cascade while replacing preview models with narrow authorized view contracts; fixture context must not enter private queries. Keep original Treido branding/art and approved compact phone copy. Actual provider-unavailable states cannot be replaced with fictional empty/paid/published data. Apply the state matrix in [UI verification](ui-verification.md), including adjacent buyer/Studio surfaces for shared CSS/font changes.

## Live product publication and contact

T39 reuses the existing product gallery/lightbox, product price typography, disclosures and floating navigation for accepted database listings. The new scoped facts/action region shows actual personal/business seller kind, condition, locality, defects and handover details. Contact and report actions use the authenticated messaging/report routes. Seller-authored copy is plain text; UI captions have BG/EN messages in `publication-messages.json`. No reference prices, ratings, carts, buy buttons or delivery promises substitute for missing commerce services.

The private saved-review page provides the explicit publish form and subsequent public link/withdraw action. A failed acknowledgement retains the same retry request; changed fields or media require a refreshed review. Published editor URLs route back to review so they do not offer a save that the server rejects. Wider source styling and the independent `/admin-preview` are unchanged by this integration.

## Definition of done

Relevant unit/interaction tests pass, changed routes handle empty/error/pending states, browser console/hydration is checked and visible changes have matched-state evidence. Verify keyboard/focus, Back/Forward, scroll restoration, long Bulgarian/English text and affected breakpoints. Record measured payload/performance changes; “more Server Components” alone is not a performance result.
