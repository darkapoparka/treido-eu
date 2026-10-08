# Seller onboarding and workspace

This is the route and interaction contract for GLOBAL-ONBOARD and the personal/business selling workspace. It extends [journeys J02–J04](journeys.md), [marketplace authority](marketplace.md), [backend execution](backend.md) and the existing [frontend](frontend.md) and [styling](../styling.md) rules. Routes/actions implement account creation, optional signup intent, seller selection, durable drafts and resumable business details/declarations through Clerk/`pg`/Drizzle adapters. Intended live bindings and full onboarding/workspace acceptance remain unqualified. Implementation and evidence remain in [tasks T04/T06/T10](../tasks.md).

The current personal path authenticates at `/sell`, opens the editor directly and atomically creates missing personal ownership with the first explicit draft save. `/sell?intent=business` continues to `/app/onboarding`; submitting a business name creates that seller and its owner in one transaction. `/app` lists currently authorized accounts; `/app/sellers/<sellerId>` shows recent unrestricted drafts. `/app/products` resolves a currently readable personal seller or a sole readable account; multiple businesses require an explicit choice. `/app/sellers/<sellerId>/listings` reads a bounded, authorized product index with URL-owned literal title search, publication/moderation status, newest/oldest sorting and a seller/filter/sort-bound keyset cursor. A page contains at most 30 products; tied timestamps retain microsecond precision and stable IDs. Thumbnails go through the current private media authorization route. New-item GETs create zero records. The editor saves incomplete category data and integer EUR prices, rejects stale/reused revisions and offers a human/seller/draft-scoped local input buffer. Known logout/account change or denied membership clears registered private buffers for the affected human/seller.

The editor links to `/app/sellers/<sellerId>/listings/<draftId>/review` for its saved version. This read-only review explains current publication blockers without exposing private declaration evidence or media keys. Successful publishing remains unavailable while reviewed policies, applicable accepted declarations, rights and supported handover/delivery terms are incomplete. An already published listing can be withdrawn by a currently authorised `listing.publish` actor with expected revision and retry identity. Withdrawal keeps its content/audit/moderation, stops public eligibility and new contact, and cannot be reversed by an ordinary draft edit.

General signup without an explicit Sell continuation offers `/app/intent`; skipping or changing this preference creates no seller authority. Business overview/settings resume `/app/sellers/<sellerId>/onboarding`. Public details and private declarations save separately with expected revisions and scoped retry receipts; incomplete declarations can be saved. Submission appends a versioned snapshot in `review_required`, never verification or publication approval. Only `declaration.manage` can read private fields; the checklist receives bounded status. Setup resumes the last acknowledged step, offers conflict comparison and explicit reload, and keeps unacknowledged private declaration input only in the mounted form. Links/reloads warn about unsaved changes; draft input retains its scoped device buffer. Restored/foreground private views hide while current access is checked and require retry on an unavailable check. Photos, delivery/payment configuration, publishing and other merchant tools remain implementation targets below.

The setup review step shows the current declaration's acceptance or correction reason to a member who still has `declaration.manage`. Setup and decision are read under the same transaction and current membership locks. The projection contains only decision, plain-text reason, declaration revision and review time; it omits operator identity and private evidence. Editing or resubmitting the declaration removes the superseded reason until that version is reviewed. Read-only members receive the bounded checklist without the reason. A declaration decision does not confirm seller verification, payment readiness or permission to publish.

## What Shop actually does

The prior T04a receipt records Shop 3.6.1 (502636), package `com.shopify.arrive`, inspected on October 1 on the owner-requested emulator 5580. Profile → **Start selling for free** opened a `www.shopify.com` signup webview. No item editor appeared along that inspected path; no account was created. This is historical evidence for that path, not a new emulator check or an exhaustive audit. Shopify's [admin documentation](https://help.shopify.com/en/manual/shopify-admin) describes its merchant workspace for products, orders, analytics and store operations, available through web and the Shopify app.

Treido keeps buyer discovery and seller operations in the same existing application/backend. Our private seller workspace does not require sending users to Shopify, creating another implementation, or installing another app. Personal sellers retain a quick item flow. Business sellers receive additional tools under their authorised business account.

Borrow the operational structure: a clearly selected seller, task-oriented navigation, a resumable setup checklist and an overview of work needing attention. [Shopify Home](https://help.shopify.com/en/manual/shopify-admin/shopify-home) documents setup tasks and operational cards; Treido applies that pattern to its own marketplace. We are building merchant operations for selling on Treido, not a website builder, Shopify app marketplace, POS system, arbitrary themes, domains or off-platform CRM. Existing F01–F29 scope remains intact.

## Sell entry and onboarding

**Sell** starts or resumes an item. **My selling** opens the workspace overview. A dashboard must not become a mandatory detour before creating a personal listing.

1. Guest: preserve the intended seller/draft action, open the established sign-in UI, and resume after a verified session. Never create a server draft from a reference cookie or browser user ID.
2. New human: offer skippable Buy / Sell my items / Sell as a business intent. Buying remains available regardless of the answer. A Sell entry defaults to personal selling, with a visible business option; skipping general signup intent does not prevent selling later.
3. Personal: idempotently create/resume the human's single personal seller and continue directly to the owned item editor. No store-name, team, company-registration or paid-plan gate for starting a draft.
4. Business: create a distinct business seller or select an existing authorised business. Collect public identity and necessary private trader/contact declarations progressively. Joining requires a valid invitation, not claiming a business ID. Business Free must be usable without subscribing.
5. Returning seller: resume a requested owned draft; otherwise open a new editor in a currently authorised operating seller. Default to the personal seller when no business context was deliberately selected. Remembered selection is only a hint, revalidated by the server.

Changing intent does not convert listings or membership. One human can buy, sell personally, and operate two businesses. Browsing `seller=personal|business` changes public supply; it never picks the operating `sellerId`. Verification, trader declaration, payout readiness, condition and subscription remain independent facts.

Sign-in continuation uses a server-validated internal target or opaque server-issued continuation. Reject external/protocol-relative destinations and unrelated routes. Recheck seller membership and draft ownership after return; expired sessions, deleted drafts and removed memberships need an explicit recovery state. No sign-in redirect can grant access. Recover unacknowledged input through the existing local buffer, labelled honestly until a durable server save succeeds.

## Resumable setup and readiness

Personal setup asks for the public seller name/locality and applicable declarations at the operation that needs them. Business setup creates the seller and owner atomically, then offers **Business details → First product → Delivery/returns → Payments → Review**. A human may start a draft before finishing the later steps. Team invitations and Pro are optional setup cards, not mandatory onboarding screens. The business can return to the checklist from its overview/settings.

Persist setup answers/revisions on the server; compute completion from current authoritative records and versioned requirements. Store the last visited step and dismissed optional tips as navigation preferences only. Review-required, rejected, provider-unavailable and action-required states explain the specific next action. Changed country/category/provider requirements can reopen a step. Never expose a single editable `isOnboarded` or percentage as permission to trade.

| Operation | Required facts | Does not require |
|---|---|---|
| Start/save a draft | Verified active human, current seller authority, applicable restrictions and draft quota | Public storefront, paid plan, complete listing, bank/payout onboarding |
| Publish for supported contact/handover | Current publish capability; accepted seller/trader declarations for that country; reviewed leaf; valid facts/condition/money/media; quota and moderation/visibility policy | Stripe readiness when the explicitly supported listing mode has no on-platform payment |
| Enable on-platform checkout | Publish/order eligibility plus current supported Connect capabilities, account requirements, frozen fees/tax/fulfilment terms and shared inventory allocation | Pro subscription, a browser payment-success flag |
| Receive seller payouts | Provider-confirmed payout eligibility and actual settlement/payout policy | A green setup checklist or a successful sale alone |
| Handle existing orders/cases | Current specific seller/support capability and permitted lifecycle action | New-listing quota or an active paid plan; restrictions may require the operator recovery path |

Return a minimal `SellerReadiness` projection with operation-specific allowed/blocked status, stable reason codes and permitted next actions. Keep private declaration evidence/provider payloads out of it. The query and command use the same pure rules (T04e); the command reloads current facts. A stale checklist can advise a human, but cannot authorize publication/payment.

Business public identity (name, handle, description, logo/cover, coarse locality) is separate from private legal identity/contact and required policy disclosures. Branding is optional for a first draft. Require only the fields mandated by the reviewed publication/payment policy; do not collect card/bank/identity-document forms that the payment provider can securely collect. Preview the public store using the existing seller composition and an authenticated owner projection; a draft preview URL is not public publication.

Payment setup uses Stripe-hosted Connect onboarding initially, returning to the same seller's `/settings/payments`. Generate its temporary account link only in an authenticated, currently authorized mutation. Expiry/refresh generates a new link after rechecking authority. Returning from Stripe triggers a server readiness refresh, not automatic approval. Subscription billing remains a separate `/billing` operation. The actual country/account configuration is qualified in T12a.

## Route contract

Use the existing Next.js workspace and feature-owned modules. `/app` is the private seller workspace path, not a new native app or a publicly accessible store. Seller-facing navigation uses **My selling** or **Seller workspace**.

| Target route | Purpose and access |
|---|---|
| `/sell` | Public Sell entry. Eventually resolves verified continuation into `/app`; until T04/T06 adapters exist, the current device-local preparation flow remains explicitly preparation-only. |
| `/app` | Verified human's workspace entry, overview or requested-action resolver. No seller-private data before authentication. |
| `/app/intent` | Skippable, editable human preference; never grants seller access or converts existing sellers. Explicit personal Sell bypasses it. |
| `/app/onboarding` | Explicit business creation and authorised existing-business resume links. No mandatory subscription or payout setup merely to prepare a draft. |
| `/app/sellers/[sellerId]` | Overview for a currently authorised operating seller. An ID in the URL is never permission. |
| `/app/sellers/[sellerId]/onboarding` | Persisted business details/private declaration and derived checklist. `step=details|declaration|review` is navigation only; current capabilities still govern reads/writes. |
| `/app/sellers/[sellerId]/listings` | Owned drafts, active, paused, sold and restricted listings with truthful state and allowed actions. |
| `/app/sellers/[sellerId]/listings/new` | Read-only new-item entry. An explicit create/first-save mutation creates a durable draft and redirects to its stable editor URL; GET, prefetch and refresh never create records. |
| `/app/sellers/[sellerId]/listings/[draftId]/edit` | Owned revision-aware editor. Published items continue through the same validated commands and restrictions. |
| `/app/sellers/[sellerId]/inbox` | Authorised listing conversations, participant attachments, unread state and permitted offer actions. |
| `/app/sellers/[sellerId]/orders` | Seller-scoped confirmed orders, fulfilment, cases and allowed transitions. Contact handovers remain separately labelled. |
| `/app/sellers/[sellerId]/settings` | Public profile and separately protected private settings; no private legal/contact data in buyer view models. |
| `/app/sellers/[sellerId]/settings/store`, `/settings/delivery`, `/settings/payments` | Scoped store preview/profile, qualified fulfilment/returns configuration and Connect onboarding/readiness. Payment setup is separate from purchasing a Treido plan. |
| `/app/sellers/[sellerId]/inventory` and `/imports` | Business stock/SKUs/variants and durable CSV import-to-draft tools. No bypass of publication, allocation or quota rules. |
| `/app/sellers/[sellerId]/team` | Business invitations, current capabilities, seat limits and last-owner protection. |
| `/app/sellers/[sellerId]/billing` and `/analytics` | Seller-scoped plan/usage/invoices and truthful permitted metrics. Personal-plan controls remain available where applicable. |

Published listing URLs retain `/products/[id]` and public seller/store routes retain their existing canonical composition. `/app` never replaces public discovery. Platform moderation/support tools are a separate operator surface owned by T27; business owners are not platform administrators.

## Workspace behaviour

The owner's October 2 request (D30/T30) adopts the signed-in Shopify admin appearance inside private `/app`: a 220px dark desktop sidebar, an inset rounded white canvas, compact neutral controls/cards and a floating phone menu/search with a modal navigation drawer. Use the locally licensed Inter variable font only in this shell. Home, Products and the authorized editor use this bounded merchant styling; buyer chrome and direct `/sell`/authentication typography remain unchanged. Treido branding, original artwork and real capability/readiness states replace Shopify-specific content. Preserve BG/EN labels, keyboard/Escape/focus behaviour, 320px reflow and 200% text acceptance. The browser/plugin is a read-only reference, not Treido's backend or a source of fabricated payments, orders, AI or publication approval.

Personal sellers need listings/drafts, inbox, relevant orders, profile and plan/usage. Business operators also need inventory/imports, store identity, team, fulfilment and permitted analytics. Show the operating seller clearly. Switching seller rechecks membership, clears seller-scoped pending views and rejects responses from the old context. Unsaved input requires save/recovery before leaving. Revalidate restored/foreground private views and invalidate local private projections on logout, account switch or known revocation; the server must deny every subsequent unauthorized read. Previously delivered bytes cannot be recalled from another person's browser.

The complete business navigation targets **Overview, Listings, Inventory, Orders, Inbox**, with **Store, Team, Analytics, Billing, Settings** as secondary tools. The current shell exposes the implemented Home, Products, Inventory, Inbox, authorized business Catalogue imports, business details and seller-account selection, plus buyer marketplace navigation. Remaining tools join it with their real adapters and authorized use cases. On phones use the modal dark drawer and task cards; on desktop use the Shopify-matched sidebar and bounded product tables. Business users see “Products” where appropriate; the canonical resource is still Listing. Personal users get the smaller selling navigation. Do not show inactive tools as apparently working dashboard destinations.

Overview prioritizes unfinished setup, drafts, failed uploads/imports, unread inquiries, fulfilment tasks and payment actions. Every count comes from a bounded authorized query. Hide or explain unavailable metrics; zero means an integrated query found zero. Do not reuse sample revenue/ratings or imply “no orders” when the order service failed. A connected empty store gets a first-product action.

Listing management uses URL-owned status/query/sort/cursor, stable row IDs, thumbnail/title/price, meaningful status and a next action. Status tabs are projections of publication, moderation and availability, not a new conflicting lifecycle. Bulk actions have explicit selected IDs, a bounded selection and per-item permission/revision/results; “select all” cannot secretly operate on unseen arbitrary rows. Duplicate creates a new owned draft through the normal command; it cannot clone moderation clearance, paid boosts or accepted terms. T06d owns these controls.

Use real empty states for a connected seller with no data. Missing adapters display unavailable/preparation states; mock orders, revenue, stock, payout status or successful publication cannot fill the dashboard. UI capability visibility helps navigation, but every read and command independently authenticates and rechecks current authority. Private pages do not use a shared cross-user cache.

The editor progresses through category, photos, item facts/condition/defects, price, supported handover, preview and Publish. Durability, media readiness, revisions, moderation and quotas are server-owned. A seller may start a draft before payout onboarding; on-platform checkout is enabled only after its separate country/provider eligibility and payout requirements are met. Failed saves/uploads or membership loss retain recoverable input without claiming publication.

Keep each acknowledged server revision with its buffer. Private recovery buffers are scoped to human/seller/draft and do not hold documents, tokens or payout details. The current guest category buffer may be offered for explicit import into the selected owned draft after sign-in; it must not silently attach to whichever business was last used. A conflict shows the server version and recoverable local input rather than overwriting newer edits. Clear private buffers on logout according to the user-visible recovery policy.

## Capability defaults

Roles are named templates for explicit capability sets; runtime authority is the current app-owned membership or personal ownership plus resource/state policy. UI visibility consumes a safe capability projection; it is never the enforcement boundary.

| Capability group | Personal owner | Business owner | Manager default | Member default |
|---|---|---|---|---|
| Own listing read/write/publish and inbox read/reply | Yes | Yes | Yes | Explicit grants only |
| Stock/variants/import | Not applicable | Yes within plan | Stock/variants; import requires explicit grant | Explicit grants only |
| Order read/fulfilment and commercial analytics | Own permitted operations | Yes | Explicit grants only | Explicit grants only |
| Store profile/declaration/delivery settings | Own profile/declaration | Yes | Explicit grants only | Explicit grants only |
| Billing, payment setup and refund request | Own permitted operations | Yes under money policy | Explicit grants only | Explicit grants only |
| Invite/revoke/grant team capabilities | Not applicable | Yes, with seat/last-owner constraints | Explicit delegation only; never grant beyond own delegable authority | None initially |
| Transfer ownership/close business | Not applicable | Dedicated owner flow with recent authentication | No | No |
| Platform moderation, payment override, unrestricted impersonation | No | No | No | No |

Use stable capability identifiers such as `listing.write`, `listing.publish`, `inventory.manage`, `inbox.reply`, `order.fulfil`, `billing.manage` and `team.manage`; finalize their finite catalogue in T04e. Reading an inbox/order needs its own read capability, not merely permission to mutate another feature. Publishing still requires eligibility/quota; refunds still require financial rules. No role bypasses restrictions. Sensitive owner/payout/account actions require supported recent-authentication checks; team and billing authority remain separate.

## Frontend-first merchant preview

The owner's October 2 clarification authorizes completing the merchant interface before wiring the remaining authentication and backend features. T30c implements that interface in the existing web application at `/admin-preview`, using the adopted Shopify admin typography, shell, cards, forms and responsive navigation. This is a device-local prototype; the private `/app` account and resource boundaries keep their existing behavior.

From `app/`, use the pinned runtime and `pnpm dev:web`, then open `http://127.0.0.1:6418/admin-preview?lang=en`. The existing launcher sets `SHOP_REFERENCE_PREVIEW=1` on loopback. The route returns 404 without that explicit opt-in and in hosted or production environments. A preview is not a hosted merchant entry point and is excluded from indexing.

| Area | Frontend coverage |
|---|---|
| Catalog | Products and editor, collections, quantities, CSV review/import, selection and bulk status changes |
| Orders and customers | Orders, draft conversion, fulfillment/refund dialogs, customer details and segments |
| Growth and content | Campaign plans, four discount types, content definitions, pages and a small image library |
| Operations | Markets, finance/payout views, billing overview, analytics dates/comparison and four report views |
| Workspace | Local inbox threads/replies, store identity and storefront preview, fictional team roles/invitations, notifications |
| Settings | General, plan, billing, users, payments, checkout, customer accounts, shipping, taxes, locations, markets, apps, domains, events, notifications/templates, custom data, languages, privacy and policies |

The **Frontend preview** control loads an optional fictional example store or confirms a reset of both fictional accounts. Saves stay in this browser under `treido-admin-frontend-preview-v1`. **Treido Studio** and **Personal selling** have separate catalogs and settings; choosing either is only prototype navigation. **Review with doubled text** persists the review preference across screens. Language links preserve the current screen and search. Home/navigation have Bulgarian labels; the extended merchant forms currently use English copy.

The prototype provides working inputs, local validation, saved edits/reload, tabs/search/sort, bulk selection, dialogs with Escape/focus return, import review, CSV export generation and local file previews. It uses integer EUR minor units and accepted order-line snapshots. Image uploads are PNG/JPEG/WebP up to 120 KB; CSV input is bounded to 250 KB and 500 rows. Invalid or oversized saved state displays a recovery warning. No preview action authenticates a human, grants a real role, publishes a listing/site, emails a customer, activates an app/domain/provider or charges/refunds money.

Home includes a Shopify-style plan pill linking to the local Plan settings; Treido copy carries no live promotion or subscription commitment. The welcome store name links to its appearance editor. Its prompt composer uses the inspected Home geometry, with an original Treido Mini avatar, Recents and attachment/voice controls. Seven dismissible setup cards lead to products, storefront, store details, delivery, markets and policies; restoring cards is available on Home. Treido copy and original generated artwork replace Shopify-specific offers and provider claims.

The desktop sidebar and phone menu begin with **Go to Treido / Към Treido** and **View store / Виж магазина**. Settings provides the same shortcuts. The first opens the existing buyer Home at `/?lang=en|bg`; the second opens the selected fictional store's existing local storefront directly at `/admin-preview/store/preview`, outside the admin shell. Its **Back to admin / Към панела** action returns to that store's admin Home; browser Back preserves the previous admin route and query. Language and store selection remain in the preview URL. This storefront remains a local owner preview: product links open the existing admin editors, and no published store/domain, customer checkout or seller authorization is implied.

The preview's bottom-right control opens **Sell Helper**, the seller Mini from the existing assistant catalogue, in the inspected desktop/phone assistant surface. Home opens the full assistant canvas. Other desktop pages use a compact prompt dock and a 356px side panel, with Expand/Collapse controls; phones use the full screen. The dialog restores focus and scrolling when closed, and Control/Command+K switches to global search. Its finite local tools find products by literal name/SKU/category/tag, check missing title/description/photo/price fields, and prepare a reviewable draft from seller-entered title/description. Recent prompts stay in browser session storage, separated by fictional store; selecting one reruns it against the current selected store. A checklist is not publication approval. Draft preparation never invents price, condition, stock, uploaded media or AI advice: it opens a draft with unconfirmed condition and zero price/quantity for seller review. Photos open the existing editor; voice and free-form AI explain their unavailable state without activating a microphone or calling a provider. Live assistant/auth/backend integration remains deferred.

Sidebar Search, phone-menu Search, the Settings rail/header Search and Control/Command+K open the shared global-search dialog: category chips browse the selected store's local catalog; typing finds products/SKUs, customers, orders/drafts, content and finite admin/settings destinations. Arrow keys navigate results, Enter opens the selected item, and one Escape closes a populated search and restores the trigger. Results never cross seller accounts or reference uploaded file bodies. The private Home retains its catalog trigger and real authorized product-list query instead of preview assistant results. Mobile navigation dismisses through Escape, the backdrop or destination navigation, without an invisible close target over another control.

Actual signed-in Shopify states were inspected read-only and captured locally for comparison. This delivers Treido's claimed merchant frontend coverage; it does not certify every Shopify screen, proprietary service, native mobile app or pixel-identical state. The browser walkthrough, observed differences and evidence are recorded in T30c–T30e. Real integration follows the existing owning tasks below, preserving server authorization, truthful provider errors and production guards.

## Implementation order and acceptance

| Task | Concrete outcome |
|---|---|
| T04a | Intended provider/environment bindings, secret-free validated config and isolated test plan. Available accounts alone are insufficient. |
| T04e | Pure capability/readiness/continuation contracts, reason codes and two-seller denial matrix; can start without provider credentials. |
| T04b | Verified Clerk session → idempotent local User; real isolated Neon User/Seller/Membership persistence and least-privilege access. |
| T04c | Signup intent, single personal seller, resumable business setup/declaration, authoritative readiness and continuation recovery. |
| T04d | Initial `/app` entry, seller switcher, setup checklist and private workspace shell. Personal direct-to-editor path works without waiting for advanced team/order features. |
| T04f | Outbox/Inngest execution, replay/crash recovery and first synthetic isolated consumer before production media or other durable effects. |
| T06a/T06b/T06c and T23c | Durable owned drafts, private ready media, approved leaf persistence and atomic publish/edit/withdraw using the existing form composition. |
| T06d | Seller listing index, status filters, duplicate/withdraw/retry and bounded bulk management with authoritative row results. |
| T09/T10a/T10b/T24/T25 | Real inbox/offers, teams, workspace extension, stock/variants and import tools; each section needs its owned adapter. |
| T12/T13/T26 | Qualified payout/checkout and independent seller plan/boost billing. No browser redirect or UI badge grants paid rights. |
| T27 | Separate platform operator permissions and support/moderation workspace. |
| T10c | Complete personal/business merchant journey qualification once each real feature is integrated; no placeholder panels count as delivered tools. |

Verify the complete entry with a guest, one personal seller and a human in two businesses. Exercise foreign IDs, removed membership, forged browse scope, tampered continuation, expired sign-in, duplicate setup/draft requests, reload/revision conflict and provider interruption. Personal selling must reach the editor without business/store setup; business switching must never expose another seller's data. Rendered tasks require matched-state screenshots and real controls. Configuration tests and this contract do not qualify those unimplemented journeys.

## Connected conversation and review screens

The private seller Inbox uses actual participant queries/actions, separate from `/admin-preview/inbox`. Desktop retains the compact sidebar and two-column conversation layout; phone routes show either the list or selected conversation with a return action. Plain-text replies, unread filtering, explicit contact blocking, message reporting and retry recovery are implemented in BG/EN. The Profile Messages entry opens the buyer-only inbox instead of silently selecting a business.

Listing review links to current authorized moderation history. The seller sees communicated decisions and their own appeal receipts, not another reporter's identity or details. An appeal never clears a restriction. Inbox attachments, offers, provider notifications and connected public-listing acceptance retain their own work packages.

## Connected stock and import surfaces — T42

The private Inventory destination now queries the operating seller's actual product/SKU quantities and active reservations with literal search, state filters and 30-row cursor pages. It supports ordinary stock adjustments, explicitly selected all-or-nothing bulk adjustments and a current-page CSV export. Unknown stock stays unknown; the user must configure it rather than accepting guessed quantities. Bulk forms retain their observed revisions and user input on conflict; reloading is an explicit review step. Reuse the existing Studio tables, native dialogs, buttons, phone shell and paired BG/EN messages.

Catalogue imports provide the generated empty template/category guide, bounded UTF-8 upload, row errors and corrections, explicit row selection, durable processing/cancellation/resume, created draft links and a formula-safe row report. Only currently authorized business operators can read or execute imports. New drafts still need owned photos, actual declarations and normal publication review. A queued import is not labelled completed until its database work has committed. The local component browser acceptance does not imply that Clerk, object storage or the external job callback has completed the intended live journey.


### T43 implementation — Team and service settings (2026-10-03)

The private `/app/sellers/[sellerId]/team` destination now reads current business memberships and durable invitations from PostgreSQL. It supports recipient-specific invitations, explicit capability grants, permitted member/manager changes, revocation, cancellation and a new delivery intent on explicit resend. Existing capability resolution remains authoritative, including the manager defaults. Free business capacity is three seats including the owner; live pending invitations reserve capacity for seven days under the existing seller lock. Membership changes cancel outstanding invitations issued by the changed member. Last-owner removal and manager escalation are rejected.

`/app/invitations` and `/app/invitations/[invitationId]` use fresh Clerk verified-email facts. A read does not create a domain human or membership. Acceptance is an explicit Server Action, bound to the intended recipient. Accepted replays require the same current active membership revision; a revoked membership cannot use the old invitation to rejoin. The existing Inngest repair also expires invitations without deleting their history.

Invitation creation and its `team.invitation` outbox intent are atomic. No invitation email transport has been enabled in this implementation: a pending delivery is not an email-sent receipt. Recipient-bound copyable links work independently. Resend and Stripe connections were unavailable during this session, and a Resend transport write was blocked by a tool safety check. No alternative credential transfer or transport bypass was attempted.

The real Settings destination now links the existing public-profile editor, private trader declaration flow, Team, public contact, and delivery/returns information according to current capabilities. Store profile saves can stay on the settings screen instead of moving through onboarding. Contact uses `profile.manage`; delivery uses `delivery.manage`. The two service sections have independent revisions, actor-scoped immutable retry receipts, and explicit conflict comparison. Turning public display off retains private drafts. Public storefront information is an explicit allowlist projected only for an otherwise eligible seller; trader declaration fields are never a contact fallback. These descriptive settings do not book a courier, change accepted listing snapshots, approve a declaration, or enable payments.

Owning implementation: `src/features/team/`, `src/features/seller-settings/`, the existing seller authority/setup functions, public seller projection, and jobs executor. All new controls, errors, confirmations and pending states have BG/EN copy; authored profile and service content is left unchanged by locale selection.


### T44 implementation — recipient decisions, personal profiles and batch copies

Incoming business invitations now offer an explicit decline confirmation. Declining records the intended verified human, frees the reserved seat and prevents later acceptance of that same invitation. Accepted invitations only show Open business when the recipient currently retains active seller-read access; a revoked user is directed to request current access rather than following a misleading old acceptance.

Personal sellers now have a real Public seller profile destination at `/app/sellers/[sellerId]/settings/store`. It edits the existing seller name, description and locality, with a preview labelled as unsaved input. The form preserves edits and its request identity during uncertainty. On a stale revision it compares the latest saved values and offers either loading them or retaining the current input against the reviewed new revision. This is not business conversion; private declarations remain separate, and public storefront eligibility still requires real accepted inventory.

Products now supports duplicating multiple explicitly selected rows, alongside the existing single-copy and withdrawal commands. Each selected product receives its own durable retry key and existing copy/quota transaction. Partial success is displayed per product with links to the resulting drafts; retry submits only unresolved rows with their original keys. Descriptions and normal draft facts use the existing copy behavior, while photos, stock, variants, SKUs, condition confirmation and publication are not copied. Original products remain unchanged. A refreshed or changed source requires explicit current-version selection instead of silently copying different facts.

All new surfaces use existing Studio buttons, fields, tables and native dialogs with BG/EN copy. Seller-authored content is not translated. The photo picker distinguishes an expired incomplete upload and tells the seller to remove and reselect that photo. Provider unavailability remains visible; these controls do not claim that invitation mail, connected checkout or a live photo upload is operational.


### Reservations and payment availability

The private seller workspace exposes Reservations separately from Orders. Current listing-read and inbox-read access is required to open `/app/sellers/[sellerId]/reservations`. The page shows real shared holds, original offer prices, expiry, title search, active/history pagination and conversation/inventory links. A merchant with current offer-management capabilities may explicitly confirm cancellation of an accepted hold. Cancellation uses the existing offer command and stock release; it is not a refund or shipment action. Expired, consumed and reconciliation records remain history, not fabricated paid orders.

Settings → Payments & readiness is scoped to current `billing.manage` access. When the application has no approved provider account/mode/capability binding, onboarding and capability refresh remain visibly unavailable. Current contact-only publication terms and a missing verified recent-authentication path are separate blockers; ordinary seller authorization does not waive them. Return query parameters do not establish provider readiness, settlement or orders. The screen links to already-authorized reservation, delivery and inbox controls without claiming external effects.

Buyer cart groups and accepted offers lead to `/checkout/reviews` and its private detail routes; `/reservations` is the buyer-owned hold view. Reviews preserve exact snapshots, recoverable private note input and retries, with explicit in-app inquiry previews. Archive/restore applies only to review organization and never cancels stock. These buyer surfaces retain Shop patterns; merchant controls stay inside the existing Studio shell.


### T47 inquiry management and selected reservation cancellation

The existing Inquiries queue/detail routes now include an operational Studio editor. Current inbox-reply capability enables internal status changes, and current conversation capability separately enables an explicit, previewed reply. Replies go to the existing buyer conversation and move the inquiry to Waiting for buyer; a status-only change neither sends a message nor changes a reservation. The editor shows current status/revision, historical acknowledgments and recent seller workflow history without exposing buyer private notes.

Unsent text and exact pending operations stay scoped to the human, seller and review through reloads, navigation and account/seller switching. Unknown outcomes keep the original request; current-state conflicts require an explicit keep-input or discard choice. Current access is refreshed before the editor is shown again on foreground/online recovery. Seller-authored text is never translated when BG/EN UI language changes.

Buyer and merchant reservation pages retain their existing search, pagination, prices, conversation links and individual cancellation. Eligible rows additionally offer explicit selection for a bounded cancellation batch and a confirmation dialog. Each selected row reports an acknowledged historical receipt, a rejection requiring current-row re-selection, or an unresolved outcome requiring the original request. Partial success remains visible even after cancelled rows leave the active queue. Acknowledging finished results cannot discard unresolved ones. No refund, order, shipment or automatic stock-consumption control is implied.

These controls reuse the existing Shop buyer cards/buttons and Studio shell/compact variants, with BG/EN copy and native dialogs. Their compiler/lint/audit results and the intentionally unrun browser/database suites are recorded in T47; implementation is not a claim of rendered visual parity or live payment-provider acceptance.


### Connected plans, promotions and paid-order follow-up

Existing Studio navigation composes the real Plans/Billing, Promotions, Orders, Support/Refund and purchase-feedback destinations using current seller/resource capabilities. Billing and marketing are distinct authorities; a visible link or selected seller ID does not grant either. Plan changes, portal/cancellation and promotion purchase/stop/remedy actions retain deliberate reviewed terms, expected revisions, original requests and pending/unknown recovery. Missing approved commercial products, provider bindings or signed effects remain visible as unavailable; no sample revenue or paid success is substituted.

Order controls use actual participant/order/charge facts and accepted aftercare rights. Shipping dispatch reports, buyer-confirmed receipt and unresolved states have their own presentation; legacy pickup completion is available only for pickup. Refund selection preserves original quantities and supported shipping components and exposes pending/reconciliation outcomes. Operator support access does not automatically grant refund or public-feedback moderation authority. Recipient input stays in its private shipping flow and never becomes public store/contact copy. Seller information can display only currently eligible anonymous completed-purchase feedback.

Buyer/Mini and account destinations retain their separate Shop patterns. Reviewed assistant criteria can reopen the existing strict Find flow; photo/voice permissions and processing consent remain deliberate. Saving a search is separate from enabling matching, and link/open/sign-in does not opt the user in. Preferences/security/export/closure use current own-account authority and approved lifecycle bindings; a seller workspace role does not grant access to another human's account. Existing contact reviews, inquiries, reservation batches, drafts, inventory/imports, team and eight seller/six operator insight datasets remain composed through their original feature owners.

The [backend](backend.md), [API](api.md), [marketplace](marketplace.md), [assistants](assistants.md) and [operations](operations.md) contracts own the domain rules. Source implementation and empty/error/pending UI do not establish genuine provider, current-session, rendered or release acceptance; [tasks](../tasks.md) records that evidence and the independent review boundary.
